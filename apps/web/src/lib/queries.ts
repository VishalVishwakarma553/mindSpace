"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "./api";
import type {
  ActionItem,
  GlobalActionItem,
  Meeting,
  MeetingDetail,
  MeetingNotes,
  Paginated,
  SearchResult,
  Stats,
  SystemStatus,
  User,
} from "./types";

export const keys = {
  me: ["me"] as const,
  stats: ["stats"] as const,
  meetings: (filters: object) => ["meetings", filters] as const,
  meeting: (id: string) => ["meeting", id] as const,
  actionItems: (status: string) => ["action-items", status] as const,
  search: (q: string) => ["search", q] as const,
  system: ["system"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<{ user: User }>("/auth/me").then((r) => r.user),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api.get<Stats>("/stats") });
}

export interface MeetingFilters {
  q?: string;
  searchTranscript?: boolean;
  status?: string;
  from?: string;
  to?: string;
  sort?: "asc" | "desc";
  page?: number;
}

export function useMeetings(filters: MeetingFilters) {
  return useQuery({
    queryKey: keys.meetings(filters),
    queryFn: () => api.get<Paginated<Meeting>>("/meetings", { ...filters, limit: 12 }),
    placeholderData: keepPreviousData,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: keys.meeting(id),
    queryFn: () => api.get<MeetingDetail>(`/meetings/${id}`),
    enabled: Boolean(id),
  });
}

export function useActionItems(status: "open" | "done" | "all") {
  return useQuery({
    queryKey: keys.actionItems(status),
    queryFn: () => api.get<{ items: GlobalActionItem[] }>("/action-items", { status }).then((r) => r.items),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => api.get<{ results: SearchResult[] }>("/search", { q }).then((r) => r.results),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: keys.system,
    queryFn: () => api.get<SystemStatus>("/system/status"),
    refetchInterval: 15_000,
  });
}

/** Invalidate everything derived from a meeting after a change. */
export function useInvalidateMeeting() {
  const qc = useQueryClient();
  return (id?: string) => {
    if (id) void qc.invalidateQueries({ queryKey: keys.meeting(id) });
    void qc.invalidateQueries({ queryKey: ["meetings"] });
    void qc.invalidateQueries({ queryKey: keys.stats });
    void qc.invalidateQueries({ queryKey: ["action-items"] });
  };
}

export function useUpdateMeeting(id: string) {
  const invalidate = useInvalidateMeeting();
  return useMutation({
    mutationFn: (body: Partial<Pick<Meeting, "title" | "tags" | "participants">>) =>
      api.patch<{ meeting: Meeting }>(`/meetings/${id}`, body),
    onSuccess: () => invalidate(id),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useUpdateNotes(id: string) {
  const invalidate = useInvalidateMeeting();
  return useMutation({
    mutationFn: (body: Partial<MeetingNotes>) => api.patch(`/meetings/${id}/notes`, body),
    onSuccess: () => {
      invalidate(id);
      toast.success("Notes updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

type ActionItemInput = Partial<Pick<ActionItem, "task" | "assignedTo" | "status">> & { deadline?: string | null };

/** Optimistic task updates so checking a box feels instant (ui-ux-pro-max: tap-feedback-speed). */
export function useActionItemMutations(meetingId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateMeeting();
  const key = keys.meeting(meetingId);

  const update = useMutation({
    mutationFn: ({ itemId, ...body }: ActionItemInput & { itemId: string }) =>
      api.patch(`/meetings/${meetingId}/action-items/${itemId}`, body),
    onMutate: async ({ itemId, ...body }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MeetingDetail>(key);
      if (previous?.notes) {
        qc.setQueryData<MeetingDetail>(key, {
          ...previous,
          notes: {
            ...previous.notes,
            actionItems: previous.notes.actionItems.map((a) =>
              a._id === itemId ? { ...a, ...body, deadline: body.deadline === undefined ? a.deadline : body.deadline } : a,
            ),
          },
        });
      }
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(errorMessage(e));
    },
    onSettled: () => invalidate(meetingId),
  });

  const create = useMutation({
    mutationFn: (body: ActionItemInput & { task: string }) => api.post(`/meetings/${meetingId}/action-items`, body),
    onSuccess: () => {
      invalidate(meetingId);
      toast.success("Task added");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => api.delete(`/meetings/${meetingId}/action-items/${itemId}`),
    onSuccess: () => {
      invalidate(meetingId);
      toast.success("Task deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return { update, create, remove };
}

export function useReprocess(id: string) {
  const invalidate = useInvalidateMeeting();
  return useMutation({
    mutationFn: (stage: "all" | "summary") => api.post<{ meeting: Meeting }>(`/meetings/${id}/reprocess`, { stage }),
    onSuccess: () => {
      invalidate(id);
      toast.success("Processing started");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
