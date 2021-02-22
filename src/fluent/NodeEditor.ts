import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {canvas} from "@bokehjs/core/dom"


class Vec2 {
    x: number
    y: number
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