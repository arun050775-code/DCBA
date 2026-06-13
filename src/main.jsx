import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Global: force BLOCK LETTERS in all text inputs & textareas (except email/password/date/time)
const upperHandler = (e) => {
  const el = e.target
  if (!el || !['INPUT', 'TEXTAREA'].includes(el.tagName)) return
  const skip = ['email', 'password', 'date', 'time', 'number', 'tel', 'url', 'file', 'checkbox', 'radio']
  if (skip.includes(el.type)) return
  if (el.dataset.noUpper !== undefined) return
  const upper = el.value.toUpperCase()
  if (el.value === upper) return
  const start = el.selectionStart, end = el.selectionEnd
  const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(el, upper)
  try { el.setSelectionRange(start, end) } catch {}
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
document.addEventListener('input', upperHandler, true)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
