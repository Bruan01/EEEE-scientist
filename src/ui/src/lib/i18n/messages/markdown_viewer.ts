import type { UILanguage } from '@/lib/i18n/types'

export const markdownViewerMessages: Partial<Record<UILanguage, Record<string, string>>> = {
  en: {
    loading: 'Loading markdown...',
    load_failed: 'Failed to load file',
    retry: 'Retry',
    rendered_view: 'Rendered view',
    source_view: 'Source view',
    copy_source: 'Copy source',
    demo_title: 'DeepScientist Markdown Viewer',
    demo_intro:
      'Welcome to the **Markdown Viewer** plugin. This viewer supports [GitHub Flavored Markdown](https://github.github.com/gfm/) with additional features.',
  },
  'zh-CN': {
    loading: '正在加载 Markdown...',
    load_failed: '加载文件失败',
    retry: '重试',
    rendered_view: '渲染视图',
    source_view: '源码视图',
    copy_source: '复制源码',
    demo_title: 'DeepScientist Markdown 查看器',
    demo_intro:
      '欢迎使用 **Markdown 查看器** 插件。该查看器支持 [GitHub Flavored Markdown](https://github.github.com/gfm/) 及更多增强能力。',
  },
  fr: {
    loading: 'Chargement du Markdown...',
    load_failed: 'Échec du chargement du fichier',
    retry: 'Réessayer',
    rendered_view: 'Vue rendue',
    source_view: 'Vue source',
    copy_source: 'Copier la source',
    demo_title: 'Visionneuse Markdown DeepScientist',
    demo_intro:
      'Bienvenue dans le plugin **Markdown Viewer**. Cette visionneuse prend en charge le [GitHub Flavored Markdown](https://github.github.com/gfm/) ainsi que des fonctionnalités supplémentaires.',
  },
  ja: {
    loading: 'Markdown を読み込み中...',
    load_failed: 'ファイルの読み込みに失敗しました',
    retry: '再試行',
    rendered_view: 'レンダリング表示',
    source_view: 'ソース表示',
    copy_source: 'ソースをコピー',
    demo_title: 'DeepScientist Markdown ビューア',
    demo_intro:
      '**Markdown Viewer** プラグインへようこそ。このビューアは [GitHub Flavored Markdown](https://github.github.com/gfm/) と追加機能に対応しています。',
  },
  ko: {
    loading: 'Markdown을 불러오는 중...',
    load_failed: '파일을 불러오지 못했습니다',
    retry: '다시 시도',
    rendered_view: '렌더링 보기',
    source_view: '소스 보기',
    copy_source: '소스 복사',
    demo_title: 'DeepScientist Markdown 뷰어',
    demo_intro:
      '**Markdown Viewer** 플러그인에 오신 것을 환영합니다. 이 뷰어는 [GitHub Flavored Markdown](https://github.github.com/gfm/)과 추가 기능을 지원합니다.',
  },
  ru: {
    loading: 'Загрузка Markdown...',
    load_failed: 'Не удалось загрузить файл',
    retry: 'Повторить',
    rendered_view: 'Рендеринг',
    source_view: 'Исходный код',
    copy_source: 'Скопировать исходный код',
    demo_title: 'Просмотр Markdown в DeepScientist',
    demo_intro:
      'Добро пожаловать в плагин **Markdown Viewer**. Этот просмотрщик поддерживает [GitHub Flavored Markdown](https://github.github.com/gfm/) и дополнительные возможности.',
  },
}
