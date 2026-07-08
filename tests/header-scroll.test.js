import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('header scroll', () => {
  let header
  let scrollHandler

  beforeEach(() => {
    vi.resetModules()
    header = {
      classList: {
        contains: vi.fn(() => false),
        toggle: vi.fn(),
      },
    }
    vi.stubGlobal('window', {
      scrollY: 0,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'scroll') scrollHandler = handler
      }),
    })
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => header),
      documentElement: {
        classList: { toggle: vi.fn() },
      },
    })
    vi.doMock('../js/router.js', () => ({
      getCurrentPath: () => '/',
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

  it('hides header after scrolling down on home feed', async () => {
    const { initHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 120
    scrollHandler()
    window.scrollY = 140
    scrollHandler()

    expect(header.classList.toggle).toHaveBeenCalledWith('header--hidden', true)
  })

  it('shows header again when scrolling up', async () => {
    const { initHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 120
    scrollHandler()
    window.scrollY = 140
    scrollHandler()
    window.scrollY = 120
    scrollHandler()

    expect(header.classList.toggle).toHaveBeenCalledWith('header--hidden', false)
  })

  it('resetHeaderScroll clears hidden state', async () => {
    const { initHeaderScroll, resetHeaderScroll } = await import('../js/header-scroll.js')
    initHeaderScroll()

    window.scrollY = 140
    scrollHandler()
    resetHeaderScroll()

    expect(header.classList.toggle).toHaveBeenCalledWith('header--hidden', false)
  })
})