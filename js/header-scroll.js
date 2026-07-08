/**
 * Esconde o cabeçalho ao rolar o feed da home para baixo; reaparece ao rolar para cima.
 */
import { getCurrentPath } from './router.js'

let lastScrollY = 0
let hidden = false
let bound = false

const SCROLL_DELTA = 10
const TOP_REVEAL = 56

function isHomeFeed() {
  const path = getCurrentPath()
  return path === '/' || path === ''
}

function setHidden(value) {
  if (hidden === value) return
  hidden = value
  const header = document.getElementById('header')
  if (!header) return
  header.classList.toggle('header--hidden', value)
  document.documentElement.classList.toggle('header-is-hidden', value)
}

export function showHeader() {
  setHidden(false)
}

export function resetHeaderScroll() {
  lastScrollY = window.scrollY
  setHidden(false)
}

function onScroll() {
  const header = document.getElementById('header')
  if (!header) return

  if (!isHomeFeed() || header.classList.contains('header--admin') || header.classList.contains('header--menu-open')) {
    if (hidden) setHidden(false)
    lastScrollY = window.scrollY
    return
  }

  const y = window.scrollY
  const delta = y - lastScrollY

  if (y <= TOP_REVEAL) {
    setHidden(false)
  } else if (delta > SCROLL_DELTA) {
    setHidden(true)
  } else if (delta < -SCROLL_DELTA) {
    setHidden(false)
  }

  lastScrollY = y
}

export function initHeaderScroll() {
  if (bound) return
  bound = true
  lastScrollY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })
}