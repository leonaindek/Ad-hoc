"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

type DroppableContainerProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

export default function DroppableContainer({ id, children, className = "" }: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-150 rounded-lg ${
        isOver ? "ring-2 ring-accent/50 bg-accent/5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
