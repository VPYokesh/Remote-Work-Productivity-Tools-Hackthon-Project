const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const rectangleBtn = document.getElementById('rectangleBtn');
const circleBtn = document.getElementById('circleBtn');
const textBtn = document.getElementById('textBtn');
const colorPicker = document.getElementById('colorPicker');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const selectBtn = document.getElementById('selectBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

// Set canvas size
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

let shapes = [];
let isDragging = false;
let isResizing = false;
let startX, startY;
let selectedShape = null;
let currentTool = 'select';
let currentColor = '#000000';
let resizeHandle = null;

// Undo/Redo variables
let history = [];
let historyIndex = -1;
const maxHistoryLength = 20;

// Shape creation functions
function createRectangle(x, y) {
    const newShape = { type: 'rectangle', x, y, width: 100, height: 60, color: currentColor };
    shapes.push(newShape);
    saveState();
    return newShape;
}

function createCircle(x, y) {
    const newShape = { type: 'circle', x, y, radius: 30, color: currentColor };
    shapes.push(newShape);
    saveState();
    return newShape;
}

function createText(x, y) {
    const text = prompt('Enter text:');
    const newShape = { type: 'text', x, y, content: text, color: currentColor, fontSize: 20 };
    shapes.push(newShape);
    saveState();
    return newShape;
}

// Drawing functions
function drawShape(shape) {
    ctx.fillStyle = shape.color;
    ctx.strokeStyle = shape.color;

    if (shape.type === 'rectangle') {
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.fill();
    } else if (shape.type === 'text') {
        ctx.font = `${shape.fontSize}px Arial`;
        ctx.fillText(shape.content, shape.x, shape.y);
    }

    if (shape === selectedShape) {
        drawSelectionBox(shape);
    }
}

function drawSelectionBox(shape) {
    ctx.strokeStyle = '#00F';
    ctx.lineWidth = 2;
    if (shape.type === 'rectangle') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        drawResizeHandles(shape);
    } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        drawResizeHandles(shape);
    } else if (shape.type === 'text') {
        const textWidth = ctx.measureText(shape.content).width;
        ctx.strokeRect(shape.x, shape.y - shape.fontSize, textWidth, shape.fontSize);
    }
}

function drawResizeHandles(shape) {
    const handles = getResizeHandles(shape);
    ctx.fillStyle = '#00F';
    handles.forEach(handle => {
        ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
    });
}

function getResizeHandles(shape) {
    if (shape.type === 'rectangle') {
        return [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x, y: shape.y + shape.height },
            { x: shape.x + shape.width, y: shape.y + shape.height }
        ];
    } else if (shape.type === 'circle') {
        return [
            { x: shape.x + shape.radius, y: shape.y },
            { x: shape.x - shape.radius, y: shape.y },
            { x: shape.x, y: shape.y + shape.radius },
            { x: shape.x, y: shape.y - shape.radius }
        ];
    }
    return [];
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach(drawShape);
}

function updateActiveToolButton() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${currentTool}Btn`).classList.add('active');
}

// Undo/Redo functions
function saveState() {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push(JSON.stringify(shapes));
    if (history.length > maxHistoryLength) {
        history.shift();
    }
    historyIndex = history.length - 1;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        shapes = JSON.parse(history[historyIndex]);
        redrawCanvas();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        shapes = JSON.parse(history[historyIndex]);
        redrawCanvas();
    }
}

// Event listeners
selectBtn.addEventListener('click', () => {
    currentTool = 'select';
    updateActiveToolButton();
});
rectangleBtn.addEventListener('click', () => {
    currentTool = 'rectangle';
    updateActiveToolButton();
});
circleBtn.addEventListener('click', () => {
    currentTool = 'circle';
    updateActiveToolButton();
});
textBtn.addEventListener('click', () => {
    currentTool = 'text';
    updateActiveToolButton();
});
colorPicker.addEventListener('input', (e) => currentColor = e.target.value);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

canvas.addEventListener('mousedown', (e) => {
    startX = e.offsetX;
    startY = e.offsetY;

    if (currentTool === 'select') {
        selectedShape = shapes.find(shape => isPointInShape(startX, startY, shape));
        if (selectedShape) {
            resizeHandle = getResizeHandle(startX, startY, selectedShape);
            if (resizeHandle) {
                isResizing = true;
            } else {
                isDragging = true;
            }
        }
    } else {
        let newShape;
        switch (currentTool) {
            case 'rectangle':
                newShape = createRectangle(startX, startY);
                break;
            case 'circle':
                newShape = createCircle(startX, startY);
                break;
            case 'text':
                newShape = createText(startX, startY);
                break;
        }
        if (newShape) {
            selectedShape = newShape;
            isDragging = true;
        }
    }
    redrawCanvas();
});

canvas.addEventListener('mousemove', (e) => {
    const dx = e.offsetX - startX;
    const dy = e.offsetY - startY;

    if (isDragging && selectedShape) {
        selectedShape.x += dx;
        selectedShape.y += dy;
        startX = e.offsetX;
        startY = e.offsetY;
    } else if (isResizing && selectedShape) {
        resizeShape(selectedShape, resizeHandle, dx, dy);
        startX = e.offsetX;
        startY = e.offsetY;
    }
    redrawCanvas();
});

canvas.addEventListener('mouseup', () => {
    if (isDragging || isResizing) {
        saveState();
    }
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
});

// Helper functions
function isPointInShape(x, y, shape) {
    if (shape.type === 'rectangle') {
        return x >= shape.x && x <= shape.x + shape.width &&
               y >= shape.y && y <= shape.y + shape.height;
    } else if (shape.type === 'circle') {
        const dx = x - shape.x;
        const dy = y - shape.y;
        return Math.sqrt(dx*dx + dy*dy) <= shape.radius;
    } else if (shape.type === 'text') {
        const textWidth = ctx.measureText(shape.content).width;
        return x >= shape.x && x <= shape.x + textWidth &&
               y >= shape.y - shape.fontSize && y <= shape.y;
    }
    return false;
}

function getResizeHandle(x, y, shape) {
    const handles = getResizeHandles(shape);
    return handles.find(handle => 
        Math.abs(x - handle.x) <= 4 && Math.abs(y - handle.y) <= 4
    );
}

function resizeShape(shape, handle, dx, dy) {
    if (shape.type === 'rectangle') {
        if (handle.x === shape.x && handle.y === shape.y) {
            shape.x += dx;
            shape.y += dy;
            shape.width -= dx;
            shape.height -= dy;
        } else if (handle.x === shape.x + shape.width && handle.y === shape.y) {
            shape.y += dy;
            shape.width += dx;
            shape.height -= dy;
        } else if (handle.x === shape.x && handle.y === shape.y + shape.height) {
            shape.x += dx;
            shape.width -= dx;
            shape.height += dy;
        } else {
            shape.width += dx;
            shape.height += dy;
        }
    } else if (shape.type === 'circle') {
        const centerX = shape.x;
        const centerY = shape.y;
        if (handle.x === shape.x + shape.radius) {
            shape.radius = Math.abs(centerX + shape.radius + dx - centerX);
        } else if (handle.x === shape.x - shape.radius) {
            shape.radius = Math.abs(centerX - shape.radius + dx - centerX);
        } else if (handle.y === shape.y + shape.radius) {
            shape.radius = Math.abs(centerY + shape.radius + dy - centerY);
        } else {
            shape.radius = Math.abs(centerY - shape.radius + dy - centerY);
        }
    }
}

// Chat functionality
sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
        chatInput.value = '';
    }
}

// Initial draw and setup
saveState();
redrawCanvas();

// Resize canvas on window resize
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    redrawCanvas();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Call this initially