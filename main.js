import './style.css'

// ============================================================
// STATE
// ============================================================
let currentValue = '0'
let previousValue = null
let operator = null
let waitingForOperand = false
let expression = ''
let mode = 'basic'

const STORAGE_KEY = 'calc_history'
const MAX_HISTORY = 50

// ============================================================
// DOM REFERENCES
// ============================================================
const displayMain = document.getElementById('display-main')
const displayHistory = document.getElementById('display-history')
const historyList = document.getElementById('history-list')
const historyPanel = document.getElementById('history-panel')
const scientificRow = document.getElementById('scientific-row')
const modeBasic = document.getElementById('mode-basic')
const modeScientific = document.getElementById('mode-scientific')

// ============================================================
// HISTORY (LocalStorage)
// ============================================================
function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)))
  } catch {
    // storage full or unavailable
  }
}

function addHistory(expression, result) {
  const history = loadHistory()
  history.push({ expression, result: String(result), timestamp: Date.now() })
  saveHistory(history)
  renderHistory()
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY)
  renderHistory()
}

function renderHistory() {
  const history = loadHistory()
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-item"><span class="history-item-expr">No history yet</span></div>'
    historyPanel.classList.remove('open')
    return
  }

  historyPanel.classList.add('open')
  historyList.innerHTML = history
    .slice()
    .reverse()
    .map((item, i) => `
      <div class="history-item" data-index="${history.length - 1 - i}">
        <span class="history-item-expr">${escapeHtml(item.expression)} =</span>
        <span class="history-item-result">${escapeHtml(item.result)}</span>
      </div>
    `)
    .join('')
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ============================================================
// DISPLAY
// ============================================================
function updateDisplay() {
  displayMain.textContent = formatNumber(currentValue)
  displayHistory.textContent = expression
}

function formatNumber(value) {
  if (value === 'Error' || value === 'Infinity' || value === '-Infinity') return value
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (!isFinite(num)) return value

  // Format large/small numbers with scientific notation
  if (Math.abs(num) >= 1e15 || (Math.abs(num) < 1e-10 && num !== 0)) {
    return num.toExponential(10)
  }

  // Format with commas and limit decimals
  const parts = value.split('.')
  const intPart = parts[0]
  const decPart = parts[1] || ''
  const formattedInt = BigInt(intPart).toLocaleString('en-US')
  if (decPart) {
    return `${formattedInt}.${decPart}`
  }
  return formattedInt
}

// ============================================================
// CALCULATION ENGINE
// ============================================================
function calculate(a, b, op) {
  const numA = parseFloat(a)
  const numB = parseFloat(b)

  switch (op) {
    case 'add': return numA + numB
    case 'subtract': return numA - numB
    case 'multiply': return numA * numB
    case 'divide': return numB === 0 ? NaN : numA / numB
    case 'pow': return Math.pow(numA, numB)
    default: return numB
  }
}

function performScientific(action) {
  const num = parseFloat(currentValue)
  if (isNaN(num)) return

  let result
  let expr

  switch (action) {
    case 'sin':
      result = Math.sin(num)
      expr = `sin(${currentValue})`
      break
    case 'cos':
      result = Math.cos(num)
      expr = `cos(${currentValue})`
      break
    case 'tan':
      result = Math.tan(num)
      expr = `tan(${currentValue})`
      break
    case 'log':
      result = Math.log10(num)
      expr = `log(${currentValue})`
      break
    case 'ln':
      result = Math.log(num)
      expr = `ln(${currentValue})`
      break
    case 'sqrt':
      result = Math.sqrt(num)
      expr = `√(${currentValue})`
      break
    case 'fact':
      result = factorial(num)
      expr = `(${currentValue})!`
      break
    case 'pi':
      result = Math.PI
      expr = 'π'
      break
    case 'e':
      result = Math.E
      expr = 'e'
      break
    default:
      return
  }

  if (!isFinite(result) || isNaN(result)) {
    currentValue = 'Error'
  } else {
    currentValue = String(result)
    if (action !== 'pi' && action !== 'e') {
      addHistory(expr, currentValue)
    }
  }

  waitingForOperand = true
  expression = ''
  updateDisplay()
}

function factorial(n) {
  if (n < 0 || Math.floor(n) !== n) return NaN
  if (n > 170) return Infinity
  let result = 1
  for (let i = 2; i <= n; i++) {
    result *= i
  }
  return result
}

function performOperation(nextOperator) {
  const inputValue = parseFloat(currentValue)

  if (previousValue === null) {
    previousValue = currentValue
  } else if (operator) {
    const result = calculate(previousValue, currentValue, operator)
    if (isNaN(result) || !isFinite(result)) {
      currentValue = 'Error'
      updateDisplay()
      previousValue = null
      operator = null
      waitingForOperand = true
      expression = ''
      return
    }
    currentValue = String(result)
    previousValue = String(result)
  }

  waitingForOperand = true
  operator = nextOperator

  const opSymbols = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
    pow: '^'
  }

  expression = `${formatNumber(previousValue)} ${opSymbols[nextOperator] || nextOperator}`
  updateDisplay()
}

function handleEquals() {
  if (operator === null || previousValue === null) return

  const result = calculate(previousValue, currentValue, operator)
  const opSymbols = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
    pow: '^'
  }

  const fullExpression = `${formatNumber(previousValue)} ${opSymbols[operator]} ${formatNumber(currentValue)}`

  if (isNaN(result) || !isFinite(result)) {
    currentValue = 'Error'
    expression = ''
  } else {
    currentValue = String(result)
    expression = ''
    addHistory(fullExpression, currentValue)
  }

  previousValue = null
  operator = null
  waitingForOperand = true
  updateDisplay()
}

// ============================================================
// INPUT HANDLING
// ============================================================
function inputDigit(digit) {
  if (waitingForOperand) {
    currentValue = digit
    waitingForOperand = false
  } else {
    currentValue = currentValue === '0' ? digit : currentValue + digit
  }
  updateDisplay()
}

function inputDecimal() {
  if (waitingForOperand) {
    currentValue = '0.'
    waitingForOperand = false
  } else if (!currentValue.includes('.')) {
    currentValue += '.'
  }
  updateDisplay()
}

function inputPercent() {
  const num = parseFloat(currentValue)
  if (isNaN(num)) return
  currentValue = String(num / 100)
  updateDisplay()
}

function toggleNegate() {
  if (currentValue === '0' || currentValue === 'Error') return
  currentValue = String(parseFloat(currentValue) * -1)
  updateDisplay()
}

function backspace() {
  if (waitingForOperand || currentValue === 'Error') return
  if (currentValue.length === 1 || (currentValue.length === 2 && currentValue.startsWith('-'))) {
    currentValue = '0'
  } else {
    currentValue = currentValue.slice(0, -1)
  }
  updateDisplay()
}

function clearAll() {
  currentValue = '0'
  previousValue = null
  operator = null
  waitingForOperand = false
  expression = ''
  updateDisplay()
}

// ============================================================
// MODE TOGGLE
// ============================================================
function setMode(newMode) {
  mode = newMode
  if (mode === 'scientific') {
    scientificRow.classList.add('visible')
    modeScientific.classList.add('active')
    modeBasic.classList.remove('active')
  } else {
    scientificRow.classList.remove('visible')
    modeBasic.classList.add('active')
    modeScientific.classList.remove('active')
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.querySelectorAll('[data-digit]').forEach(btn => {
  btn.addEventListener('click', () => inputDigit(btn.dataset.digit))
})

document.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action
    switch (action) {
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
      case 'pow':
        performOperation(action)
        break
      case 'equals':
        handleEquals()
        break
      case 'clear':
        clearAll()
        break
      case 'backspace':
        backspace()
        break
      case 'decimal':
        inputDecimal()
        break
      case 'percent':
        inputPercent()
        break
      case 'negate':
        toggleNegate()
        break
      default:
        if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'pi', 'e', 'fact'].includes(action)) {
          performScientific(action)
        }
    }
  })
})

modeBasic.addEventListener('click', () => setMode('basic'))
modeScientific.addEventListener('click', () => setMode('scientific'))

document.getElementById('history-clear').addEventListener('click', clearHistory)

historyList.addEventListener('click', (e) => {
  const item = e.target.closest('.history-item')
  if (!item || item.dataset.index === undefined) return
  const history = loadHistory()
  const entry = history[parseInt(item.dataset.index)]
  if (entry) {
    currentValue = entry.result
    waitingForOperand = true
    updateDisplay()
  }
})

// ============================================================
// KEYBOARD SUPPORT
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') {
    e.preventDefault()
    inputDigit(e.key)
  } else if (e.key === '.') {
    e.preventDefault()
    inputDecimal()
  } else if (e.key === '+' || e.key === '=' && e.shiftKey) {
    e.preventDefault()
    performOperation('add')
  } else if (e.key === '-') {
    e.preventDefault()
    performOperation('subtract')
  } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
    e.preventDefault()
    performOperation('multiply')
  } else if (e.key === '/') {
    e.preventDefault()
    performOperation('divide')
  } else if (e.key === '^') {
    e.preventDefault()
    performOperation('pow')
  } else if (e.key === 'Enter' || e.key === '=') {
    e.preventDefault()
    handleEquals()
  } else if (e.key === 'Backspace') {
    e.preventDefault()
    backspace()
  } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
    e.preventDefault()
    clearAll()
  } else if (e.key === '%') {
    e.preventDefault()
    inputPercent()
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    setMode(mode === 'basic' ? 'scientific' : 'basic')
  }
})

// ============================================================
// INIT
// ============================================================
renderHistory()
updateDisplay()
