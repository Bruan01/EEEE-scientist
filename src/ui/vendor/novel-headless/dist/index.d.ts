import { EditorProviderProps, JSONContent, BubbleMenuProps, Editor } from '@tiptap/react';
export { JSONContent, useCurrentEditor as useEditor } from '@tiptap/react';
import * as _tiptap_core from '@tiptap/core';
import { Editor as Editor$1, Range, Extension, Node, Mark } from '@tiptap/core';
export { Editor as EditorInstance, InputRule } from '@tiptap/core';
import * as react from 'react';
import { FC, ReactNode, RefObject } from 'react';
import * as _tiptap_extension_horizontal_rule from '@tiptap/extension-horizontal-rule';
import * as tiptap_markdown from 'tiptap-markdown';
import * as _tiptap_extension_highlight from '@tiptap/extension-highlight';
import * as _tiptap_extension_placeholder from '@tiptap/extension-placeholder';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { KatexOptions } from 'katex';
import { DecorationSet, EditorView } from '@tiptap/pm/view';
import * as jotai from 'jotai';
import * as _tiptap_extension_image from '@tiptap/extension-image';
export { default as TiptapImage } from '@tiptap/extension-image';
export { default as CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
export { default as StarterKit } from '@tiptap/starter-kit';
export { TaskItem } from '@tiptap/extension-task-item';
export { TaskList } from '@tiptap/extension-task-list';
export { default as TiptapUnderline } from '@tiptap/extension-underline';
export { default as TextStyle } from '@tiptap/extension-text-style';
export { Color } from '@tiptap/extension-color';
export { default as TiptapLink } from '@tiptap/extension-link';
export { default as Youtube } from '@tiptap/extension-youtube';
export { default as CharacterCount } from '@tiptap/extension-character-count';
export { default as GlobalDragHandle } from 'tiptap-extension-global-drag-handle';
import { GetReferenceClientRect } from 'tippy.js';

interface EditorRootProps {
    readonly children: ReactNode;
}
declare const EditorRoot: FC<EditorRootProps>;
type EditorContentProps = Omit<EditorProviderProps, "content"> & {
    readonly children?: ReactNode;
    readonly className?: string;
    readonly initialContent?: JSONContent;
};
declare const EditorContent: react.ForwardRefExoticComponent<Omit<EditorProviderProps, "content"> & {
    readonly children?: ReactNode;
    readonly className?: string;
    readonly initialContent?: JSONContent;
} & react.RefAttributes<HTMLDivElement>>;

interface EditorBubbleProps extends Omit<BubbleMenuProps, "editor"> {
    readonly children: ReactNode;
}
declare const EditorBubble: react.ForwardRefExoticComponent<EditorBubbleProps & react.RefAttributes<HTMLDivElement>>;

interface EditorBubbleItemProps {
    readonly children: ReactNode;
    readonly asChild?: boolean;
    readonly onSelect?: (editor: Editor) => void;
}
declare const EditorBubbleItem: react.ForwardRefExoticComponent<EditorBubbleItemProps & Omit<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref">, "onSelect"> & react.RefAttributes<HTMLDivElement>>;

declare const EditorCommand: react.ForwardRefExoticComponent<Omit<{
    children?: React.ReactNode;
} & Pick<Pick<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof react.HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof react.HTMLAttributes<HTMLDivElement> | "asChild"> & {
    label?: string;
    shouldFilter?: boolean;
    filter?: (value: string, search: string, keywords?: string[]) => number;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    loop?: boolean;
    disablePointerSelection?: boolean;
    vimBindings?: boolean;
} & react.RefAttributes<HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const EditorCommandList: react.ForwardRefExoticComponent<{
    children?: React.ReactNode;
} & Pick<Pick<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof react.HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof react.HTMLAttributes<HTMLDivElement> | "asChild"> & {
    label?: string;
} & react.RefAttributes<HTMLDivElement>>;

interface EditorCommandItemProps {
    readonly onCommand: ({ editor, range, }: {
        editor: Editor$1;
        range: Range;
    }) => void;
}
declare const EditorCommandItem: react.ForwardRefExoticComponent<EditorCommandItemProps & Omit<{
    children?: React.ReactNode;
} & Omit<Pick<Pick<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof react.HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof react.HTMLAttributes<HTMLDivElement> | "asChild">, "onSelect" | "value" | "disabled"> & {
    disabled?: boolean;
    onSelect?: (value: string) => void;
    value?: string;
    keywords?: string[];
    forceMount?: boolean;
} & react.RefAttributes<HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const EditorCommandEmpty: react.ForwardRefExoticComponent<{
    children?: React.ReactNode;
} & Pick<Pick<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "key" | keyof react.HTMLAttributes<HTMLDivElement>> & {
    ref?: React.Ref<HTMLDivElement>;
} & {
    asChild?: boolean;
}, "key" | keyof react.HTMLAttributes<HTMLDivElement> | "asChild"> & react.RefAttributes<HTMLDivElement>>;

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        customkeymap: {
            /**
             * Select text between node boundaries
             */
            selectTextWithinNodeBoundaries: () => ReturnType;
        };
    }
}
declare const CustomKeymap: Extension<any, any>;

declare const ImageResizer: FC;

interface TwitterOptions {
    /**
     * Controls if the paste handler for tweets should be added.
     * @default true
     * @example false
     */
    addPasteHandler: boolean;
    HTMLAttributes: Record<string, any>;
    /**
     * Controls if the twitter node should be inline or not.
     * @default false
     * @example true
     */
    inline: boolean;
    /**
     * The origin of the tweet.
     * @default ''
     * @example 'https://tiptap.dev'
     */
    origin: string;
}
/**
 * The options for setting a tweet.
 */
type SetTweetOptions = {
    src: string;
};
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        twitter: {
            /**
             * Insert a tweet
             * @param options The tweet attributes
             * @example editor.commands.setTweet({ src: 'https://x.com/seanpk/status/1800145949580517852' })
             */
            setTweet: (options: SetTweetOptions) => ReturnType;
        };
    }
}
/**
 * This extension adds support for tweets.
 */
declare const Twitter: Node<TwitterOptions, any>;

interface MathematicsOptions {
    /**
     * By default LaTeX decorations can render when mathematical expressions are not inside a code block.
     * @param state - EditorState
     * @param pos - number
     * @returns boolean
     */
    shouldRender: (state: EditorState, pos: number) => boolean;
    /**
     * @see https://katex.org/docs/options.html
     */
    katexOptions?: KatexOptions;
    HTMLAttributes: Record<string, any>;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        LatexCommand: {
            /**
             * Set selection to a LaTex symbol
             */
            setLatex: ({ latex }: {
                latex: string;
            }) => ReturnType;
            /**
             * Unset a LaTex symbol
             */
            unsetLatex: () => ReturnType;
        };
    }
}
/**
 * This extension adds support for mathematical symbols with LaTex expression.
 *
 * NOTE: Don't forget to import `katex/dist/katex.min.css` CSS for KaTex styling.
 *
 * @see https://katex.org/
 */
declare const Mathematics: Node<MathematicsOptions, any>;

declare const UpdatedImage: _tiptap_core.Node<_tiptap_extension_image.ImageOptions, any>;

interface AIHighlightOptions {
    HTMLAttributes: Record<string, string>;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        AIHighlight: {
            /**
             * Set a AIHighlight mark
             */
            setAIHighlight: (attributes?: {
                color: string;
            }) => ReturnType;
            /**
             * Toggle a AIHighlight mark
             */
            toggleAIHighlight: (attributes?: {
                color: string;
            }) => ReturnType;
            /**
             * Unset a AIHighlight mark
             */
            unsetAIHighlight: () => ReturnType;
        };
    }
}
declare const AIHighlight: Mark<AIHighlightOptions, any>;
declare const removeAIHighlight: (editor: Editor$1) => void;
declare const addAIHighlight: (editor: Editor$1, color?: string) => void;

declare const Command: Extension<any, any>;
declare const renderItems: (elementRef?: RefObject<Element> | null) => {
    onStart: (props: {
        editor: Editor$1;
        clientRect: DOMRect;
    }) => false | undefined;
    onUpdate: (props: {
        editor: Editor$1;
        clientRect: GetReferenceClientRect;
    }) => void;
    onKeyDown: (props: {
        event: KeyboardEvent;
    }) => any;
    onExit: () => void;
};
interface SuggestionItem {
    title: string;
    description: string;
    icon: ReactNode;
    searchTerms?: string[];
    command?: (props: {
        editor: Editor$1;
        range: Range;
    }) => void;
}
declare const createSuggestionItems: (items: SuggestionItem[]) => SuggestionItem[];
declare const handleCommandNavigation: (event: KeyboardEvent) => true | undefined;

declare const PlaceholderExtension: _tiptap_core.Extension<_tiptap_extension_placeholder.PlaceholderOptions, any>;
declare const HighlightExtension: _tiptap_core.Mark<_tiptap_extension_highlight.HighlightOptions, any>;
declare const MarkdownExtension: _tiptap_core.Extension<tiptap_markdown.MarkdownOptions, tiptap_markdown.MarkdownStorage>;
declare const Horizontal: _tiptap_core.Node<_tiptap_extension_horizontal_rule.HorizontalRuleOptions, any>;

declare const UploadImagesPlugin: ({ imageClass }: {
    imageClass: string;
}) => Plugin<DecorationSet>;
interface ImageUploadOptions {
    validateFn?: (file: File) => void;
    onUpload: (file: File) => Promise<unknown>;
}
declare const createImageUpload: ({ validateFn, onUpload }: ImageUploadOptions) => UploadFn;
type UploadFn = (file: File, view: EditorView, pos: number) => void;
declare const handleImagePaste: (view: EditorView, event: ClipboardEvent, uploadFn: UploadFn) => boolean;
declare const handleImageDrop: (view: EditorView, event: DragEvent, moved: boolean, uploadFn: UploadFn) => boolean;

declare function isValidUrl(url: string): boolean;
declare function getUrlFromString(str: string): string | null | undefined;
declare const getPrevText: (editor: Editor$1, position: number) => string;
declare const getAllContent: (editor: Editor$1) => string;

declare const queryAtom: jotai.PrimitiveAtom<string> & {
    init: string;
};
declare const rangeAtom: jotai.PrimitiveAtom<Range | null> & {
    init: Range | null;
};

export { AIHighlight, Command, CustomKeymap, EditorBubble, EditorBubbleItem, EditorCommand, EditorCommandEmpty, EditorCommandItem, EditorCommandList, EditorContent, type EditorContentProps, EditorRoot, HighlightExtension, Horizontal as HorizontalRule, ImageResizer, type ImageUploadOptions, MarkdownExtension, Mathematics, PlaceholderExtension as Placeholder, type SuggestionItem, Twitter, UpdatedImage, type UploadFn, UploadImagesPlugin, addAIHighlight, createImageUpload, createSuggestionItems, getAllContent, getPrevText, getUrlFromString, handleCommandNavigation, handleImageDrop, handleImagePaste, isValidUrl, queryAtom, rangeAtom, removeAIHighlight, renderItems };
