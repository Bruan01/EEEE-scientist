"use client";

import * as React from "react";

export interface FileTreeDragContextValue {
  readOnly: boolean;
  armedId?: string | null;
  setArmedId?: ((id: string | null) => void) | undefined;
  externalDragActive?: boolean;
  externalDropTargetId?: string | null;
}

const defaultValue: FileTreeDragContextValue = {
  readOnly: true,
  armedId: null,
  setArmedId: undefined,
  externalDragActive: false,
  externalDropTargetId: null,
};

const FileTreeDragContext =
  React.createContext<FileTreeDragContextValue>(defaultValue);

export function useFileTreeDragContext(): FileTreeDragContextValue {
  return React.useContext(FileTreeDragContext);
}

export { FileTreeDragContext };
