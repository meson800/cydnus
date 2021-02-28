import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {canvas} from "@bokehjs/core/dom"

// CONSTANT COLORS
const COLOR_NODE_INTERIOR: string = "rgba(90, 90, 90, 0.75)"
const COLOR_NODE_TITLE: string = "rgba(50, 50, 50, 0.75)"
const COLOR_NODE_SHADOW: string = "rgba(0,0,0,0)"
const PORT_COLORS: string[] = ["rgb(161, 161, 161)", "rgb(99, 199, 99)", "rgb(99, 99, 199)", "rgb(199, 199, 41)", "rgb(229, 139, 86)"]



enum PortType {
    Scalar = 0,
    Events = 1,
    String = 2,
    Metadata = 3,
    Style = 4,
}

interface Port {
    is_output: boolean
    type: PortType
    name: string
}

class Vec2 {
    x: number
    y: number


    constructor(x: number = 0, y: number = 0) {
        this.x = x
        this.y = y
    }
}


/**
 * Creates a new path representing a rectangle with all four corners rounded.
 * Stroking or filling the path is up to the function user!
 * 
 * @param ctx Canvas drawing context to use
 * @param x The x coordinate of the upper left corner of the rounded rectangle
 * @param y The y coordinate of the upper left corner of the rounded rectangle
 * @param width The width of the rectangle
 * @param height The height of the rectangle
 * @param radius The radius of the rounded corners
 */
function pathRoundedRectangle(ctx: CanvasRenderingContext2D, x: number, y: number,
    width: number, height: number, radius: number): void {
        // Start in upper left corner
        ctx.beginPath()
        ctx.moveTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.lineTo(x + width - radius, y)
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
        ctx.lineTo(x + width, y + height - radius)
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        ctx.lineTo(x + radius, y + height)
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
        ctx.closePath()
}

function pathUpperRoundedRectangle(ctx: CanvasRenderingContext2D, x: number, y: number,
    width: number, height: number, radius: number): void {
        // Start in upper left corner
        ctx.beginPath()
        ctx.moveTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.lineTo(x + width - radius, y)
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
        ctx.lineTo(x + width, y + height)
        ctx.lineTo(x, y + height)
        ctx.closePath()
    }

class UIStatus {
    canvas_dragging: boolean
    origin: Vec2
    scale: number

    constructor() {
        this.canvas_dragging = false
        this.origin = {x: 0, y: 0}
        this.scale = 1.0
    }

    /**
     * Converts canvas/screen coordinates to drawing coordinates.
     * @param pos A position in canvas coordinates (e.g. mouse coords) to be converted
     * @returns A Vec2 representing a point in drawing space
     */
    canvasToDrawCoord(pos: Vec2): Vec2 {
        const ret: Vec2 = new Vec2()
        ret.x = (pos.x - this.origin.x) / this.scale
        ret.y = (pos.y - this.origin.y) / this.scale
        return ret
    }

    /**
     * Converts drawing coordinates to canvas/screen coordinates.
     * @param pos A position in drawing coordinates to be converted
     * @returns A Vec2 representing a point in canvas/screen space
     */
    drawToCanvasCoord(pos: Vec2): Vec2 {
        const ret: Vec2 = new Vec2()
        ret.x = (pos.x * this.scale) + this.origin.x
        ret.y = (pos.y * this.scale) + this.origin.y
        return ret
    }
}

class Node {
    name: string
    location: Vec2
    radius: number = 8
    font_size: number = 9
    ports: Port[] = []

    constructor(name: string, loc: Vec2) {
        this.name = name
        this.location = loc
    }

    /**
     * Draws this node onto a canvas
     * @param ctx A canvas rendering context to draw with
     */
    draw(ctx: CanvasRenderingContext2D) {

        const size: Vec2 = this.calculateSize(ctx)
        ctx.save()

        // Draw main node rectangle
        ctx.shadowBlur = 12
        ctx.shadowColor = 'black'
        ctx.shadowOffsetY = 7

        pathRoundedRectangle(ctx, this.location.x, this.location.y, size.x, size.y, this.radius)
        ctx.fillStyle = COLOR_NODE_INTERIOR
        ctx.fill()

        ctx.shadowBlur = 0
        ctx.shadowColor = COLOR_NODE_SHADOW
        ctx.shadowOffsetY = 0

        pathUpperRoundedRectangle(ctx, this.location.x, this.location.y, size.x, 14, this.radius)
        ctx.fillStyle = COLOR_NODE_TITLE
        ctx.fill()

        // Draw text
        ctx.font = `${this.font_size}px sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"
        ctx.fillStyle = "white"
        ctx.fillText(this.name, this.location.x + this.radius, this.location.y + this.font_size + 1)

        // Draw ports
        for (var i: number = 0; i < this.ports.length; i++) {
            const port = this.ports[i]
            ctx.fillStyle = PORT_COLORS[port.type]
            ctx.strokeStyle = "black"
            ctx.lineWidth = 1

            const port_loc = new Vec2(
                this.location.x + (port.is_output ? size.x : 0),
                this.location.y + 20 + (i * 2 * this.font_size))

            ctx.beginPath()
            ctx.arc(port_loc.x, port_loc.y, 5, 0, 2 * Math.PI)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()

            ctx.textAlign = port.is_output ? "right" : "left"
            ctx.textBaseline = "middle"
            ctx.fillStyle = "white"
            ctx.fillText(port.name, port_loc.x + (10 * (port.is_output ? -1 : 1)), port_loc.y)

        }
        ctx.restore()
    }

    /**
     * Calculates the size of the node, by the current context.
     * @param ctx A canvas rendering context to draw with
     */
    calculateSize(ctx: CanvasRenderingContext2D): Vec2 {
        ctx.save()
        ctx.font = `${this.font_size}px sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"

        const title_width = ctx.measureText(this.name).width

        var max_width = title_width
        console.log(max_width)
        this.ports.forEach((port: Port) => {
            max_width = Math.max(max_width, ctx.measureText(port.name).width)
            console.log(ctx.measureText(port.name).width)
            console.log(max_width)
        })

        ctx.restore()

        // Allocate font_size * 2 for each port

        return new Vec2(max_width + (this.radius * 2) + 10, 25 + (this.font_size * this.ports.length * 2))
    }
}

export class NodeEditorView extends HTMLBoxView {

    canvas: HTMLCanvasElement
    draw_ctx: CanvasRenderingContext2D | null
    ui_status: UIStatus

    connect_signals(): void {
        super.connect_signals()
    }

    /**
     * Dispatches a mouse down event.
     * 
     * @param ev The mouse event associated with the mouse down event
     */
    handleMouseDown(ev: MouseEvent) {
        if (ev.button == 1) {
            this.ui_status.canvas_dragging = true
            ev.preventDefault()
        }

    }

    /**
     * Dispatches a mouse up event.
     * 
     * @param ev The mouse event associated with the mouse up event
     */
    handleMouseUp(ev: MouseEvent) {
        if (ev.button == 1) {
            this.ui_status.canvas_dragging = false
            ev.preventDefault()
        }

    }

    /**
     * Dispatches a mouse move event.
     * 
     * @param ev The mouse event associated with the mouse move event
     */
    handleMouseMove(ev: MouseEvent) {
        if (this.ui_status.canvas_dragging) {
            this.ui_status.origin.x += ev.movementX
            this.ui_status.origin.y += ev.movementY
            this.redraw()
        }
    }

    handleWheel(ev: WheelEvent) {
        ev.preventDefault()

        // Account for client bounding rectangle padding
        const rect: DOMRect = this.canvas.getBoundingClientRect()
        const drawCoords: Vec2 = this.ui_status.canvasToDrawCoord({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        })
        console.log('cx:', ev.clientX, 'cy:', ev.clientY)
        const offset: number = .03 * Math.sign(ev.deltaY)
        this.ui_status.origin.x += (offset * drawCoords.x) * this.ui_status.scale
        this.ui_status.origin.y += (offset * drawCoords.y) * this.ui_status.scale
        this.ui_status.scale *= 1.0 - offset
        this.redraw()
    }

    /**
     * Redraws the canvas element, using ui_status to set the drawing functions
     */
    redraw() {
        if (this.draw_ctx) {
            const scale = this.ui_status.scale
            const origin = this.ui_status.origin

            const upperLeft = this.ui_status.canvasToDrawCoord({x: 0, y: 0})
            const bottomRight = this.ui_status.canvasToDrawCoord({
                x: this.canvas.width,
                y: this.canvas.height
            })
            console.log("UL:", upperLeft, "BR:", bottomRight)

            // Clear by clearing/setting transform
            this.draw_ctx.setTransform(1,0,0,1,0,0)
            this.draw_ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
            this.draw_ctx.setTransform(scale, 0, 0, scale, origin.x, origin.y)

            this.drawGrids()
            const node = new Node('Test node', new Vec2(1.2, 2.4))
            node.ports.push({"is_output": true, "name": "Shorter port name", "type": PortType.Events})
            node.ports.push({"is_output": false, "name": "Testing a really really really long port name", "type": PortType.Events})
            node.ports.push({"is_output": false, "name": "Scalar port", "type": PortType.Scalar})
            node.ports.push({"is_output": false, "name": "Metadata port", "type": PortType.Metadata})
            node.ports.push({"is_output": false, "name": "String port", "type": PortType.String})
            node.ports.push({"is_output": false, "name": "Style port", "type": PortType.Style})
            node.draw(this.draw_ctx)
        }

    }
    /**
     * Draws a grid on the canvas, with the desired spacing and style
     * 
     * @param spacing The number of pixels between grid lines.
     * @param width The width of the grid lines in pixels.
     * @param color The color of the grid lines
     */
    drawGrid(spacing: number, width: number, color: string): void {
        const roundDown = (x: number): number => {
            return Math.min(x, Math.floor(x / spacing) * spacing)
        }
        const roundUp = (x: number): number => {
            return Math.max(x, Math.ceil(x / spacing) * spacing)
        }
        
        const upperLeft = this.ui_status.canvasToDrawCoord({x: 0, y: 0})
        const bottomRight = this.ui_status.canvasToDrawCoord({
            x: this.canvas.width,
            y: this.canvas.height
        })

        upperLeft.x = roundDown(upperLeft.x)
        upperLeft.y = roundDown(upperLeft.y)
        bottomRight.x = roundUp(bottomRight.x)
        bottomRight.y = roundUp(bottomRight.y)

        if (this.draw_ctx) {
            this.draw_ctx.beginPath()
            for (var i: number = upperLeft.x; i < bottomRight.x; i += spacing) {
                this.draw_ctx.moveTo(i, upperLeft.y)
                this.draw_ctx.lineTo(i, bottomRight.y)
            }

            for (var j: number = upperLeft.y; j < bottomRight.y; j += spacing) {
                this.draw_ctx.moveTo(upperLeft.x, j)
                this.draw_ctx.lineTo(bottomRight.x, j)
            }
            // Stroke thin lines
            this.draw_ctx.lineWidth = width
            this.draw_ctx.strokeStyle = color
            this.draw_ctx.stroke()
        }


    }
    drawGrids(): void {
        this.drawGrid(25, 1.0, '#131313')
        this.drawGrid(25 * 5, 2.0, '#131313')
    }

    render(): void {
        super.render()

        this.canvas = canvas({
      style: {
        padding: '2px',
        backgroundColor: '#232323',
      },
      width: 500,
      height: 400
    })

        this.ui_status = new UIStatus()
        console.log(this.ui_status)
        // Setup mouse events
        this.canvas.addEventListener("mousedown", (ev) => this.handleMouseDown(ev))
        this.canvas.addEventListener("mouseup", (ev) => this.handleMouseUp(ev))
        this.canvas.addEventListener("mousemove", (ev) => this.handleMouseMove(ev))
        this.canvas.addEventListener("wheel", (ev) => this.handleWheel(ev))
        
        this.draw_ctx = this.canvas.getContext("2d")
        this.el.appendChild(this.canvas)

        this.redraw()
    }
}

export class NodeEditor extends HTMLBox {
    static __name__ = "NodeEditor"
    static __module__ = "fluent.NodeEditor"

    static init_NodeEditor(): void {
        this.prototype.default_view = NodeEditorView
    }
}