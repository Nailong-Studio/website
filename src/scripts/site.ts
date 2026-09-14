/* ============================================================
   site.ts — 全站客户端行为（渐进增强，无框架）
   1. 主题切换 / 专注模式（持久化 + 无闪烁）
   2. 移动端抽屉菜单
   3. 滚动进场 reveal（IntersectionObserver）
   4. 阅读进度条
   5. 图片加载淡入
   6. 灯箱（原生 <dialog>，键盘可达）
   7. 画廊即时过滤（chips 为真实链接，JS 可用时接管）
   ============================================================ */

const doc = document.documentElement
const STORE = { theme: "nl:theme", focus: "nl:focus" } as const

/* ---------- 1. 主题 / 专注模式 ---------- */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 隐私模式忽略 */
  }
}

function initToggles() {
  const themeBtn = document.querySelector<HTMLButtonElement>("[data-toggle-theme]")
  themeBtn?.addEventListener("click", () => {
    const next = doc.dataset.theme === "light" ? "dark" : "light"
    doc.dataset.theme = next
    writePref(STORE.theme, next)
    themeBtn.setAttribute("aria-pressed", String(next === "light"))
    themeBtn.setAttribute("aria-label", next === "light" ? "切换到深色模式" : "切换到浅色模式")
    doc.classList.add("theme-anim")
    window.setTimeout(() => doc.classList.remove("theme-anim"), 480)
  })

  const focusBtn = document.querySelector<HTMLButtonElement>("[data-toggle-focus]")
  focusBtn?.addEventListener("click", () => {
    const next = doc.dataset.focus === "on" ? "off" : "on"
    doc.dataset.focus = next
    writePref(STORE.focus, next)
    focusBtn.setAttribute("aria-pressed", String(next === "on"))
    pauseDecor(next === "on")
  })
}

/* 减少动态效果：暂停 hero canvas 的 rAF */
function pauseDecor(paused: boolean) {
  window.dispatchEvent(new CustomEvent(paused ? "nl:pause-decor" : "nl:resume-decor"))
}

/* ---------- 2. 抽屉菜单 ---------- */
function initDrawer() {
  const drawer = document.querySelector<HTMLElement>("[data-drawer]")
  const toggle = document.querySelector<HTMLButtonElement>("[data-drawer-toggle]")
  if (!drawer || !toggle) return
  const setOpen = (open: boolean) => {
    drawer.dataset.open = String(open)
    drawer.toggleAttribute("inert", !open)
    toggle.setAttribute("aria-expanded", String(open))
    document.body.style.overflow = open ? "hidden" : ""
  }
  setOpen(false)
  toggle.addEventListener("click", () => setOpen(drawer.dataset.open !== "true"))
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)))
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.dataset.open === "true") setOpen(false)
  })
}

/* ---------- 3. 滚动进场 ---------- */
function initReveal() {
  const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]")
  if (!nodes.length) return
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduce || !("IntersectionObserver" in window)) {
    nodes.forEach((n) => (n.dataset.revealed = "true"))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement
          const delay = Number(el.dataset.revealDelay ?? 0)
          window.setTimeout(() => (el.dataset.revealed = "true"), delay)
          io.unobserve(el)
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  )
  nodes.forEach((n) => io.observe(n))
}

/* ---------- 4. 阅读进度 ---------- */
function initProgress() {
  const bar = document.querySelector<HTMLElement>(".progress")
  if (!bar) return
  let raf = 0
  const update = () => {
    raf = 0
    const max = document.documentElement.scrollHeight - innerHeight
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0
    bar.style.setProperty("--p", p.toFixed(4))
  }
  const nav = document.querySelector<HTMLElement>(".site-nav")
  const syncNav = () => {
    if (nav) nav.classList.toggle("is-scrolled", scrollY > 12)
  }
  addEventListener(
    "scroll",
    () => {
      if (!raf) raf = requestAnimationFrame(update)
      syncNav()
    },
    { passive: true }
  )
  update()
  syncNav()
}

/* ---------- 5. 图片淡入 ---------- */
function initImageFade() {
  const imgs = document.querySelectorAll<HTMLImageElement>("img[data-fade]")
  imgs.forEach((img) => {
    const done = () => (img.dataset.loaded = "true")
    if (img.complete && img.naturalWidth > 0) done()
    else {
      img.addEventListener("load", done, { once: true })
      img.addEventListener("error", done, { once: true })
    }
  })
}

/* ---------- 6. 灯箱 ---------- */
type LBItem = { full: string; srcset?: string; title: string; href: string; w: number; h: number }

function toItem(el: HTMLElement): LBItem {
  return {
    full: el.dataset.lbFull!,
    srcset: el.dataset.lbSrcset || undefined,
    title: el.dataset.lbTitle || "",
    href: el.dataset.lbHref || "",
    w: Number(el.dataset.lbW || 0),
    h: Number(el.dataset.lbH || 0),
  }
}

function collectItems(scope: ParentNode): LBItem[] {
  return Array.from(scope.querySelectorAll<HTMLElement>("[data-lb]")).map(toItem)
}

function initLightbox() {
  const dlg = document.querySelector<HTMLDialogElement>("[data-lightbox]")
  if (!dlg || typeof dlg.showModal !== "function") return
  const img = dlg.querySelector<HTMLImageElement>(".lightbox__img")!
  const caption = dlg.querySelector<HTMLElement>("[data-lb-caption]")!
  const openLink = dlg.querySelector<HTMLAnchorElement>("[data-lb-open]")!
  const counter = dlg.querySelector<HTMLElement>("[data-lb-counter]")!
  let items: LBItem[] = []
  let index = 0

  const render = () => {
    const it = items[index]
    if (!it) return
    img.src = it.full
    if (it.srcset) img.srcset = it.srcset
    else img.removeAttribute("srcset")
    img.alt = it.title
    if (it.w && it.h) {
      img.width = it.w
      img.height = it.h
    }
    caption.textContent = it.title
    counter.textContent = `${index + 1} / ${items.length}`
    openLink.href = it.href || it.full
    dlg.dataset.pending = "false"
  }

  const open = (list: LBItem[], i: number) => {
    items = list
    index = i
    render()
    dlg.showModal()
    document.body.style.overflow = "hidden"
  }

  const step = (delta: number) => {
    if (!items.length) return
    index = (index + delta + items.length) % items.length
    render()
  }

  document.addEventListener("click", (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>("[data-lb]")
    if (trigger) {
      e.preventDefault()
      const scope = trigger.closest<HTMLElement>("[data-lb-scope]") ?? document
      const els = Array.from(scope.querySelectorAll<HTMLElement>("[data-lb]"))
      const idx = Math.max(0, els.indexOf(trigger))
      open(els.map(toItem), idx)
      return
    }
    // 详情页大图也复用灯箱
    const solo = (e.target as HTMLElement).closest<HTMLElement>("[data-lb-solo]")
    if (solo) {
      e.preventDefault()
      open(collectItems(solo.parentElement ?? document), 0)
    }
  })

  dlg.querySelector("[data-lb-prev]")?.addEventListener("click", () => step(-1))
  dlg.querySelector("[data-lb-next]")?.addEventListener("click", () => step(1))
  dlg.querySelector("[data-lb-close]")?.addEventListener("click", () => dlg.close())
  dlg.addEventListener("close", () => {
    document.body.style.overflow = ""
    img.removeAttribute("src")
  })
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close()
  })
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1)
    if (e.key === "ArrowRight") step(1)
  })
}

/* ---------- 8. 光标柔光斑（桌面 + 非减弱动效） ---------- */
function initCursorGlow() {
  const g = document.querySelector<HTMLElement>(".cursor-glow")
  if (!g) return
  if (!matchMedia("(pointer: fine)").matches) return
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  let x = innerWidth / 2
  let y = innerHeight / 2
  let tx = x
  let ty = y
  let raf = 0
  const tick = () => {
    raf = 0
    x += (tx - x) * 0.18
    y += (ty - y) * 0.18
    g.style.transform = `translate(${x}px, ${y}px)`
    if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) raf = requestAnimationFrame(tick)
  }
  addEventListener(
    "pointermove",
    (e) => {
      tx = e.clientX
      ty = e.clientY
      if (!raf) raf = requestAnimationFrame(tick)
    },
    { passive: true }
  )
}

/* ---------- 9. 画廊即时过滤 ---------- */
function initFilter() {
  const bar = document.querySelector<HTMLElement>("[data-filterbar]")
  const grid = document.querySelector<HTMLElement>("[data-grid]")
  if (!bar || !grid) return
  const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-cat]"))
  const counter = document.querySelector<HTMLElement>("[data-filter-count]")
  const chips = Array.from(bar.querySelectorAll<HTMLElement>("[data-chip]"))

  const apply = (cat: string, push: boolean) => {
    let shown = 0
    for (const card of cards) {
      const hit = cat === "all" || card.dataset.cat === cat
      if (hit) shown++
    }
    chips.forEach((c) => {
      if (c.dataset.chip === cat) c.setAttribute("aria-current", "page")
      else c.removeAttribute("aria-current")
    })
    if (counter) counter.textContent = `${shown} 件`
    if (push) {
      const target = chips.find((c) => c.dataset.chip === cat)?.getAttribute("href")
      if (target) history.pushState({ cat }, "", target)
    }
    document.dispatchEvent(new CustomEvent("nl:filtered", { detail: { cat, shown } }))

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      for (const card of cards) card.hidden = !(cat === "all" || card.dataset.cat === cat)
      return
    }
    grid.classList.add("is-filtering")
    window.setTimeout(() => {
      let i = 0
      for (const card of cards) {
        const hit = cat === "all" || card.dataset.cat === cat
        card.hidden = !hit
        if (hit) {
          card.classList.remove("is-enter")
          void card.offsetWidth
          card.style.setProperty("--enter-i", String(i++))
          card.classList.add("is-enter")
        }
      }
      grid.classList.remove("is-filtering")
    }, 220)
  }

  bar.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-chip]")
    if (!chip) return
    e.preventDefault()
    apply(chip.dataset.chip!, true)
  })
  addEventListener("popstate", () => apply(currentCategory(), false))

  function currentCategory(): string {
    const m = location.pathname.match(/gallery\/([a-z]+)\/?$/)
    return m ? m[1] : "all"
  }
  // 初始状态由服务端渲染决定，无需重复过滤
}

/* ---------- 10. 数字滚动计数（hero 统计） ---------- */
function initCountUp() {
  const els = document.querySelectorAll<HTMLElement>("[data-countup]")
  if (!els.length) return
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduce) return
  els.forEach((el) => {
    const txt = el.textContent ?? ""
    const m = txt.match(/^([^\d]*)([\d.,]+)(.*)$/s)
    if (!m) return
    const pre = m[1]
    const numStr = m[2].replace(/,/g, "")
    const post = m[3]
    const target = Number(numStr)
    if (!isFinite(target) || target <= 0) return
    const dur = 1100
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      el.textContent = pre + Math.round(target * e).toLocaleString("en-US") + post
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/* ---------- 11. 详情页键盘翻页（← / → 跳上/下一件；灯箱打开时让行） ---------- */
function initArtworkPager() {
  const prev = document.querySelector<HTMLAnchorElement>("[data-pager-prev]")
  const next = document.querySelector<HTMLAnchorElement>("[data-pager-next]")
  if (!prev && !next) return
  const dlg = document.querySelector<HTMLDialogElement>("[data-lightbox]")
  const go = (el: HTMLAnchorElement | null) => {
    const href = el?.getAttribute("href")
    if (href) location.href = href
  }
  addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    if (dlg && dlg.open) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
    if (e.key === "ArrowLeft" && prev) {
      e.preventDefault()
      go(prev)
    } else if (e.key === "ArrowRight" && next) {
      e.preventDefault()
      go(next)
    }
  })
}

/* ---------- 启动 ---------- */
function boot() {
  initToggles()
  initDrawer()
  initReveal()
  initProgress()
  initImageFade()
  initLightbox()
  initFilter()
  initCursorGlow()
  initCountUp()
  initArtworkPager()
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot)
else boot()
