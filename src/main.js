import './style.css'
import { renderApp } from './app.js'

document.getElementById('app').innerHTML = renderApp()

// Boot after DOM is set
import('./boot.js').then(m => m.boot())
