export type Side = "left" | "right";

export interface Review {
  metadata: {
    owner: string;
    repo: string;
    number: number;
  };
  reviewers: Record<string, boolean>;
  threads: Thread[];
  comments: Comment[];
}

export interface ThreadArgs {
  // TODO: It's much more complex than this
  file: string;
  side: Side;
  line: number;
}

export interface Thread extends ThreadArgs {
  id: string;
  resolved: boolean;
}

export interface CommentArgs {
  username: string;
  photoURL: string;
  text: string;
}

export interface Comment extends CommentArgs {
  id: string;
  threadId: string;
  draft: boolean;
  timestamp: string;
}

export interface ThreadPair {
  left: Thread | null;
  right: Thread | null;
}

export function threadMatch(thread: Thread, args: ThreadArgs): boolean {
  return (
    args.file === thread.file &&
    args.line === thread.line &&
    args.side === thread.side
  );
}
