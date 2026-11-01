// Web card for `/clear`, hand-written in dsh's client-bundle format (no build step).
// The shell loads this file as a plain script; `require` reaches only the shell's shared modules.
// Eraser icon paths from Lucide (ISC license, https://lucide.dev).
window.__ModuleLoader__.load({
  id: 'dsh-clear-conversation',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const { useState } = require('react')
    const { jsx, jsxs } = require('react/jsx-runtime')
    const { DisclosureRow } = require('@deepseek-ai/dsh-client-ui-primitives')

    const NAMESPACE = 'dsh-clear-conversation'
    const en = {
      cleared: 'Context cleared',
      running: 'Clearing context…',
      failed: 'Context not cleared',
      heading: 'Cleared from the model’s view'
    }
    const zh = {
      cleared: '上下文已清除',
      running: '正在清除上下文…',
      failed: '上下文未清除',
      heading: '已从模型视野中清除'
    }

    const CSS = [
      '.dshcc-root{margin:2px 0}',
      '.dshcc-title{font-size:15px;font-weight:600}',
      '.dshcc-summary{margin-left:8px;font-size:13px;opacity:.72}',
      '.dshcc-body{padding:6px 0 6px 24px;font-size:13px;line-height:1.6}',
      '.dshcc-heading{font-size:13px;font-weight:600;margin-bottom:2px}',
      '.dshcc-item{opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshcc-notice{margin-top:8px;padding:6px 8px;border-radius:6px;background:rgba(77,107,254,.10)}'
    ].join('')
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-clear-conversation"]') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = NAMESPACE
      tag.dataset.pluginCss = NAMESPACE
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    const ICON = jsxs('svg', {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      children: [
        jsx('path', { d: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21' }),
        jsx('path', { d: 'M22 21H7' }),
        jsx('path', { d: 'm5 11 9 9' })
      ]
    })

    /**
     * Split the host's `/clear` text: line 1 is the summary, then optional "Cleared:" bullets and
     * an optional update notice, separated by blank lines (see formatClearSummary in clear.js).
     */
    function parseSummary(text) {
      const lines = String(text ?? '').split('\n')
      const first = lines[0] ?? ''
      const cleared = first.startsWith('Context cleared')
      const summary = cleared ? first.replace(/^Context cleared( · )?/, '') : first
      const items = lines.filter((line) => line.startsWith('• ')).map((line) => line.slice(2))
      const blocks = lines.slice(1).join('\n').split('\n\n').map((block) => block.trim()).filter(Boolean)
      const notice = blocks.find((block) => !block.startsWith('Cleared:'))
      return { cleared, summary, items, notice }
    }

    function ClearCard({ node, t }) {
      const [open, setOpen] = useState(false)
      const outcome = node.outcome
      const running = outcome === null
      const failed = outcome?.kind === 'error'
      const parsed = parseSummary(outcome?.text)
      const title = running ? t('running') : failed ? t('failed') : parsed.cleared ? t('cleared') : '/clear'
      const hasBody = !running && !failed && (parsed.items.length > 0 || parsed.notice !== undefined)
      const body = open && hasBody
        ? jsxs('div', {
            className: 'dshcc-body',
            children: [
              parsed.items.length > 0 ? jsx('div', { className: 'dshcc-heading', children: t('heading') }) : null,
              ...parsed.items.map((item, i) => jsx('div', { className: 'dshcc-item', title: item, children: `• ${item}` }, i)),
              parsed.notice !== undefined ? jsx('div', { className: 'dshcc-notice', children: parsed.notice }) : null
            ]
          })
        : undefined
      return jsx('div', {
        className: 'dshcc-root',
        'data-state': running ? 'running' : failed ? 'error' : 'ok',
        children: jsx(DisclosureRow, {
          icon: ICON,
          title,
          titleClassName: 'dshcc-title',
          running,
          open: open && hasBody,
          expandable: hasBody,
          expandOnRowClick: true,
          keepContentWhenOpen: true,
          onToggle: () => setOpen((value) => !value),
          collapsedContent: parsed.summary ? jsx('span', { className: 'dshcc-summary', children: parsed.summary }) : undefined,
          children: body
        })
      })
    }

    const inject = ['slots', 'locale']
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NAMESPACE, { en, zh }), 'dsh-clear-conversation: dictionaries')
      ctx.slots.inject('conversation.chat.commandview', () =>
        ctx.slots.register({ name: 'conversation.chat.commandview', key: 'clear', locale: NAMESPACE }, ClearCard)
      )
    }

    exports.inject = inject
    exports.apply = apply
    exports.parseSummary = parseSummary
    exports.ClearCard = ClearCard
    return module.exports
  }
})
