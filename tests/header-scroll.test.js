import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('header scroll on mobile', () => {
  let scrollHandler
  let header
  let htmlClassList
  let matchMedia

  beforeEach(() => {
    vi.resetModules()
    header = { classList: { toggle: vi.fn() } }
    htmlClassList = { toggle: vi.fn() }
    matchMedia = { matches: true, addEventListener: vi.fn() }

    vi.stubGlobal('window', {
      scrollY: 0,
      innerWidth: 390,
      matchMedia: vi.fn(() => matchMedia),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'scroll') scrollHandler = handler
      }),
    })
    vi.stubGlobal('document', {
      getElementById: vi.fn((id) => (id === 'header' ? header : null)),
      documentElement: { classList: htmlClassList },
      body: { classList: { contains: vi.fn(() => false) } },
    })
    vi.doMock('../js/ui.js', () => ({
      closeMobileMenu: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initHeaderScroll registers a passive scroll listener once', async () => {
    const { initHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()
    initHeaderScroll()
    expect(window.addEventListener).toHaveBeenCalledTimes(1)
    expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
  })

  it('hides header after scrolling down on mobile', async () => {
    const { initHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 120
    scrollHandler()
    window.scrollY = 140
    scrollHandler()

    expect(header.classList.toggle).toHaveBeenCalledWith('header--scroll-hidden', true)
    expect(htmlClassList.toggle).toHaveBeenCalledWith('header-scroll-hidden', true)
  })

  it('shows header again when scrolling up', async () => {
    const { initHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 140
    scrollHandler()
    window.scrollY = 120
    scrollHandler()

    expect(header.classList.toggle).toHaveBeenCalledWith('header--scroll-hidden', false)
  })

  it('does not hide header when mobile menu is open', async () => {
    document.body.classList.contains.mockReturnValue(true)
    const { initHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 200
    scrollHandler()

    expect(header.classList.toggle).not.toHaveBeenCalledWith('header--scroll-hidden', true)
  })

  it('resetHeaderScroll clears hidden state', async () => {
    const { initHeaderScroll, resetHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 200
    scrollHandler()
    resetHeaderScroll()

    expect(header.classList.toggle).toHaveBeenCalledWith('header--scroll-hidden', false)
  })
})