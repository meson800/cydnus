import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {canvas} from "@bokehjs/core/dom"
import * as bprop from "@bokehjs/core/properties"
import * as btypes from "@bokehjs/core/types"

import {Node} from "./node_models"

// Following the example of
// https://github.com/bokeh/bokeh/blob/35c49c5865d574601bcd4627484905a4071366a0/bokehjs/src/lib/core/bokeh_events.ts#L9

// CONSTANT COLORS
const COLOR_IntNode_INTERIOR: string = "rgba(90, 90, 90, 0.75)"
const COLOR_IntNode_TITLE: string = "rgba(50, 50, 50, 0.75)"
const COLOR_IntNode_SHADOW: string = "rgba(0,0,0,0)"
const COLOR_IntNode_HIGHLIGHT: string = "white"
const COLOR_STREAM: string = "white"
const IntPort_COLORS: string[] = ["rgb(161, 161, 161)", "rgb(99, 199, 99)", "rgb(99, 99, 199)", "rgb(199, 199, 41)", "rgb(229, 139, 86)"]


enum UIStatusMode {
    None,
    CanvasDragging,
    IntNodeDragging,
    IntPortDrawing,
}
enum UIActionType {
    NA,
    Drag,
    IntPort,
    Internal
}

interface UIAction {
    type: UIActionType
    IntPort_id?: number
}

enum IntPortType {
    Scalar = 0,
    Events = 1,
    String = 2,
    Metadata = 3,
    Style = 4,
}

interface IntPort {
    is_output: boolean
    type: IntPortType
    name: string
}

interface Stream {
    out_IntNode: number,
    out_IntPort: number,
    in_IntNode: number,
    in_IntPort: number
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
    mode: UIStatusMode
    origin: Vec2
    scale: number
    selected_IntNodes: Set<number>
    lastMouseDrawLoc: Vec2
    lastIntPortIntNode: number
    lastIntPort: number

    constructor() {
        this.mode = UIStatusMode.None
        this.origin = {x: 0, y: 0}
        this.scale = 1.0
        this.selected_IntNodes = new Set<number>()
        this.lastMouseDrawLoc = {x: 0, y: 0}
        this.lastIntPortIntNode = 0
        this.lastIntPort = 0
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

class IntNode {
    name: string
    location: Vec2
    radius: number = 8
    font_size: number = 9
    IntPorts: IntPort[] = []

    constructor(name: string, loc: Vec2) {
        this.name = name
        this.location = loc
    }

    /**
     * Draws this IntNode onto a canvas
     * @param ctx A canvas rendering context to draw with
     * @param isSelected If the IntNode is currently selected.
     */
    draw(ctx: CanvasRenderingContext2D, isSelected: boolean) {

        const size: Vec2 = this.calculateSize(ctx)
        ctx.save()

        // Draw main IntNode rectangle
        ctx.shadowBlur = 12
        ctx.shadowColor = 'black'
        ctx.shadowOffsetY = 7

        this.pathOutline(ctx, size)
        ctx.fillStyle = COLOR_IntNode_INTERIOR
        ctx.fill()

        if (isSelected) {
            ctx.save()
            ctx.strokeStyle = COLOR_IntNode_HIGHLIGHT
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()
        }

        ctx.shadowBlur = 0
        ctx.shadowColor = COLOR_IntNode_SHADOW
        ctx.shadowOffsetY = 0

        pathUpperRoundedRectangle(ctx, this.location.x, this.location.y, size.x, 14, this.radius)
        ctx.fillStyle = COLOR_IntNode_TITLE
        ctx.fill()

        // Draw text
        ctx.font = `${this.font_size}px sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"
        ctx.fillStyle = "white"
        ctx.fillText(this.name, this.location.x + this.radius, this.location.y + this.font_size + 1)

        // Draw IntPorts
        for (var i: number = 0; i < this.IntPorts.length; i++) {
            const IntPort = this.IntPorts[i]
            ctx.fillStyle = IntPort_COLORS[IntPort.type]
            ctx.strokeStyle = "black"
            ctx.lineWidth = 1

            const IntPort_loc: Vec2 = this._getIntPortLocation(size, i)
            this.pathIntPort(ctx, size, i)
            ctx.fill()
            ctx.stroke()

            ctx.textAlign = IntPort.is_output ? "right" : "left"
            ctx.textBaseline = "middle"
            ctx.fillStyle = "white"
            ctx.fillText(IntPort.name, IntPort_loc.x + (10 * (IntPort.is_output ? -1 : 1)), IntPort_loc.y)

        }
        ctx.restore()
    }

    pathOutline(ctx: CanvasRenderingContext2D, size: Vec2): void {
        pathRoundedRectangle(ctx, this.location.x, this.location.y, size.x, size.y, this.radius)
    }

    _getIntPortLocation(size: Vec2, IntPort_idx: number): Vec2 {
        const IntPort: IntPort = this.IntPorts[IntPort_idx]
        return new Vec2(
            this.location.x + (IntPort.is_output ? size.x : 0),
            this.location.y + 25 + (IntPort_idx * 2 * this.font_size))
    }

    getIntPortLocation(ctx: CanvasRenderingContext2D, IntPort_idx: number): Vec2 {
        return this._getIntPortLocation(this.calculateSize(ctx), IntPort_idx)
    }

    pathIntPort(ctx: CanvasRenderingContext2D, size: Vec2, IntPort_idx: number): void {
        if (IntPort_idx >= 0 && IntPort_idx < this.IntPorts.length) {
            const IntPort_loc = this._getIntPortLocation(size, IntPort_idx)

            ctx.beginPath()
            ctx.arc(IntPort_loc.x, IntPort_loc.y, 5, 0, 2 * Math.PI)
            ctx.closePath()
        }
    }

    handleMouse(ctx: CanvasRenderingContext2D, screen_coords: Vec2) : UIAction {
        const size: Vec2 = this.calculateSize(ctx)

        // Check each of the IntPorts:
        for (let i: number = 0; i < this.IntPorts.length; i++) {
            this.pathIntPort(ctx, size, i)
            if (ctx.isPointInPath(screen_coords.x, screen_coords.y)) {
                return {'type': UIActionType.IntPort, 'IntPort_id': i}
            }
        }

        // Check for general outline purposes
        this.pathOutline(ctx,size)
        if (ctx.isPointInPath(screen_coords.x, screen_coords.y)) {
            return {'type': UIActionType.Drag}
        } else {
        }
        return {'type': UIActionType.NA}

    }

    /**
     * Calculates the size of the IntNode, by the current context.
     * @param ctx A canvas rendering context to draw with
     */
    calculateSize(ctx: CanvasRenderingContext2D): Vec2 {
        ctx.save()
        ctx.font = `${this.font_size}px sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"

        const title_width = ctx.measureText(this.name).width

        var max_width = title_width
        this.IntPorts.forEach((IntPort: IntPort) => {
            max_width = Math.max(max_width, ctx.measureText(IntPort.name).width)
        })

        ctx.restore()

        // Allocate font_size * 2 for each IntPort

        return new Vec2(max_width + (this.radius * 2) + 10, 25 + (this.font_size * this.IntPorts.length * 2))
    }


}

export class NodeEditorView extends HTMLBoxView {
    model: NodeEditor

    canvas: HTMLCanvasElement
    draw_ctx: CanvasRenderingContext2D | null
    ui_status: UIStatus
    nodes: Map<number, IntNode>
    streams: Set<Stream>

    last_IntNode_uid: number

    connect_signals(): void {
        super.connect_signals()
    }

    getMouseCanvasLoc(ev: MouseEvent): Vec2 {
        if (this.canvas && this.draw_ctx) {
            const rect: DOMRect = this.canvas.getBoundingClientRect()
            return new Vec2(ev.clientX - rect.left, ev.clientY - rect.top)
        }
        return new Vec2()
    }

    getMouseDrawLoc(ev: MouseEvent): Vec2 {
        return this.ui_status.canvasToDrawCoord(this.getMouseCanvasLoc(ev))
    }

    /**
     * Dispatches a mouse down event.
     * 
     * @param ev The mouse event associated with the mouse down event
     */
    handleMouseDown(ev: MouseEvent) {
        if (this.draw_ctx) {
            const mouseCanvasLoc: Vec2 = this.getMouseCanvasLoc(ev)

            switch (ev.button) {
                case 0: {
                    // Check each IntNode to see if we are selecting it
                    let lastAction: UIAction = {type: UIActionType.NA}
                    let lastId: number | undefined
                    for (const [id, IntNode] of this.nodes) {
                        const action: UIAction = IntNode.handleMouse(this.draw_ctx, mouseCanvasLoc)
                        if (action.type != UIActionType.NA) {
                            lastAction = action
                            lastId = id
                        }
                    }
                    // Deselect IntNodes if we didn't click a IntNode
                    if (lastAction.type == UIActionType.NA) {
                        this.ui_status.selected_IntNodes.clear()
                    }

                    if (lastAction.type == UIActionType.Drag && lastId != undefined) {
                        // Check status. First, if we are NOT holding shift and we clicked
                        // a previously unselected item, we should clear the selected IntNode list
                        if (!ev.shiftKey && !this.ui_status.selected_IntNodes.has(lastId)) {
                            this.ui_status.selected_IntNodes.clear()
                        }
                        
                        // Add this IntNode to the selected list if it isn't already:
                        if (!this.ui_status.selected_IntNodes.has(lastId)) {
                            this.ui_status.selected_IntNodes.add(lastId)
                        }

                        // If we have > 0 selected IntNodes, go into drag mode
                        if (this.ui_status.selected_IntNodes.size > 0) {
                            this.ui_status.mode = UIStatusMode.IntNodeDragging
                        }
                    } else if (lastAction.type == UIActionType.IntPort && lastId != undefined &&
                        lastAction.IntPort_id != undefined) {
                        // Start drawing :)
                        this.ui_status.mode = UIStatusMode.IntPortDrawing
                        this.ui_status.lastMouseDrawLoc = this.getMouseDrawLoc(ev)

                        const select_IntNode = this.nodes.get(lastId)
                        if (select_IntNode && lastAction.IntPort_id >= 0 && lastAction.IntPort_id < select_IntNode.IntPorts.length) {
                            this.ui_status.lastIntPortIntNode = lastId
                            this.ui_status.lastIntPort = lastAction.IntPort_id
                            // If this is an input IntNode, disconnect the stream if it exists
                            if (!select_IntNode.IntPorts[lastAction.IntPort_id].is_output) {
                                let prior_stream: Stream | undefined = undefined
                                this.streams.forEach(stream => {
                                    if (stream.in_IntNode == lastId && stream.in_IntPort == lastAction.IntPort_id) {
                                        prior_stream = stream
                                        this.ui_status.lastIntPortIntNode = stream.out_IntNode
                                        this.ui_status.lastIntPort = stream.out_IntPort
                                    }

                                    if (stream.out_IntNode == lastId && stream.out_IntPort == lastAction.IntPort_id) {
                                        prior_stream = stream
                                        this.ui_status.lastIntPortIntNode = stream.in_IntNode
                                        this.ui_status.lastIntPort = stream.in_IntPort
                                    }
                                })
                                if (prior_stream) {
                                    this.streams.delete(prior_stream)
                                }
                            }
                        }
                    }

                    this.redraw()
                    break
                }
                case 1: {
                    if (this.ui_status.mode == UIStatusMode.None) {
                        this.ui_status.mode = UIStatusMode.CanvasDragging
                    }
                    ev.preventDefault()
                    break
                }
                default: {
                    break
                }
            }
        }
    }

    /**
     * Dispatches a mouse up event.
     * 
     * @param ev The mouse event associated with the mouse up event
     */
    handleMouseUp(ev: MouseEvent) {
        if (this.draw_ctx) {
            const mouseCanvasLoc: Vec2 = this.getMouseCanvasLoc(ev)
            switch (ev.button) {
                case 0: {

                    if (this.ui_status.mode == UIStatusMode.IntPortDrawing) {
                        // Check to see if we can complete a stream
                        let lastAction: UIAction = {type: UIActionType.NA}
                        let lastId: number | undefined
                        for (const [id, IntNode] of this.nodes) {
                            const action: UIAction = IntNode.handleMouse(this.draw_ctx, mouseCanvasLoc)
                            if (action.type != UIActionType.NA) {
                                lastAction = action
                                lastId = id
                            }
                        }

                        if (lastAction.type == UIActionType.IntPort && lastId != undefined && lastAction.IntPort_id != undefined) {
                            const stream: Stream = {
                                'in_IntNode': this.ui_status.lastIntPortIntNode,
                                'in_IntPort': this.ui_status.lastIntPort,
                                'out_IntNode': lastId,
                                'out_IntPort': lastAction.IntPort_id
                            }

                            const in_IntNode = this.nodes.get(stream.in_IntNode)
                            const out_IntNode = this.nodes.get(stream.out_IntNode)
                            if (in_IntNode && out_IntNode
                                && stream.in_IntPort >= 0 && stream.in_IntPort < in_IntNode.IntPorts.length
                                && stream.out_IntPort >= 0 && stream.out_IntPort < out_IntNode.IntPorts.length) {
                                    const in_IntPort = in_IntNode.IntPorts[stream.in_IntPort]
                                    const out_IntPort = out_IntNode.IntPorts[stream.out_IntPort]

                                    if (stream.in_IntNode != stream.out_IntNode
                                        && in_IntPort.is_output != out_IntPort.is_output
                                        && in_IntPort.type == out_IntPort.type) {
                                        
                                        this.streams.add(stream)
                                    }
                                }

                        }
                    }
                    this.ui_status.mode = UIStatusMode.None
                    this.redraw()
                    break
                }
                case 1: {
                    if (this.ui_status.mode == UIStatusMode.CanvasDragging) {
                        this.ui_status.mode = UIStatusMode.None
                    }
                    ev.preventDefault()
                    break
                }
                default: {
                    break
                }
            }
        }
    }

    /**
     * Dispatches a mouse move event.
     * 
     * @param ev The mouse event associated with the mouse move event
     */
    handleMouseMove(ev: MouseEvent) {
        switch (this.ui_status.mode) {
            case UIStatusMode.CanvasDragging: {
                this.ui_status.origin.x += ev.movementX
                this.ui_status.origin.y += ev.movementY
                this.redraw()
                break
            }
            case UIStatusMode.IntPortDrawing: {
                this.ui_status.lastMouseDrawLoc = this.getMouseDrawLoc(ev)
                this.redraw()
                break
            }
            case UIStatusMode.IntNodeDragging: {
                for (const id of this.ui_status.selected_IntNodes) {
                    const IntNode = this.nodes.get(id)
                    if (IntNode) {
                        IntNode.location.x += ev.movementX / this.ui_status.scale
                        IntNode.location.y += ev.movementY / this.ui_status.scale
                    }
                }
                this.redraw()
                break
            }
            default: {
                break
            }
        }
    }

    handleWheel(ev: WheelEvent) {
        ev.preventDefault()

        // Account for client bounding rectangle padding
        const drawCoords: Vec2 = this.getMouseDrawLoc(ev)
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
        console.log(this.model)
        if (this.draw_ctx) {
            const scale = this.ui_status.scale
            const origin = this.ui_status.origin

            // Clear by clearing/setting transform
            this.draw_ctx.setTransform(1,0,0,1,0,0)
            this.draw_ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
            this.draw_ctx.setTransform(scale, 0, 0, scale, origin.x, origin.y)

            this.drawGrids()

            // Draw streams
            this.draw_ctx.save()
            this.draw_ctx.lineWidth = 3
            this.draw_ctx.strokeStyle = COLOR_STREAM
            for (const stream of this.streams) {
                const in_IntNode = this.nodes.get(stream.in_IntNode)
                const out_IntNode = this.nodes.get(stream.out_IntNode)
                if(in_IntNode && out_IntNode) {
                    if (stream.in_IntPort >= 0 && stream.out_IntPort >= 0 &&
                        stream.in_IntPort < in_IntNode.IntPorts.length &&
                        stream.out_IntPort < out_IntNode.IntPorts.length) {
                        const in_loc: Vec2 = in_IntNode.getIntPortLocation(this.draw_ctx, stream.in_IntPort)
                        const out_loc: Vec2 = out_IntNode.getIntPortLocation(this.draw_ctx, stream.out_IntPort)
                        this.draw_ctx.beginPath()
                        this.draw_ctx.moveTo(in_loc.x, in_loc.y)
                        this.draw_ctx.lineTo(out_loc.x, out_loc.y)
                        this.draw_ctx.stroke()
                    }

                }
            }
            this.draw_ctx.restore()
            // Draw IntNodes
            for (const [id, IntNode] of this.nodes) {
                IntNode.draw(this.draw_ctx, this.ui_status.selected_IntNodes.has(id))
            }

            // Draw stream in progress
            if (this.ui_status.mode == UIStatusMode.IntPortDrawing) {
                const in_IntNode = this.nodes.get(this.ui_status.lastIntPortIntNode)
                if (in_IntNode && this.ui_status.lastIntPort >= 0 && this.ui_status.lastIntPort < in_IntNode.IntPorts.length) {
                    const in_loc: Vec2 = in_IntNode.getIntPortLocation(this.draw_ctx, this.ui_status.lastIntPort)
                    this.draw_ctx.save()
                    this.draw_ctx.lineWidth = 3
                    this.draw_ctx.strokeStyle = COLOR_STREAM
                    this.draw_ctx.beginPath()
                    this.draw_ctx.moveTo(in_loc.x, in_loc.y)
                    this.draw_ctx.lineTo(this.ui_status.lastMouseDrawLoc.x, this.ui_status.lastMouseDrawLoc.y)
                    this.draw_ctx.stroke()
                    this.draw_ctx.restore()
                }
            }

            // Draw status bar
            this.draw_ctx.save()
            this.draw_ctx.setTransform(1,0,0,1,0,0)
            this.draw_ctx.font = "11px sans-serif"
            this.draw_ctx.textAlign = "left"
            this.draw_ctx.textBaseline = "bottom"
            this.draw_ctx.fillStyle = "white"
            let statusbar_text: string = "fluentjs-v0.0.1"
            this.draw_ctx.fillText(statusbar_text, 5, this.canvas.height)
            this.draw_ctx.restore()

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
      width: 800,
      height: 600
    })

        this.ui_status = new UIStatus()
        // Setup mouse events
        this.canvas.addEventListener("mousedown", (ev) => this.handleMouseDown(ev))
        this.canvas.addEventListener("mouseup", (ev) => this.handleMouseUp(ev))
        this.canvas.addEventListener("mousemove", (ev) => this.handleMouseMove(ev))
        this.canvas.addEventListener("wheel", (ev) => this.handleWheel(ev))
        
        this.draw_ctx = this.canvas.getContext("2d")
        this.el.appendChild(this.canvas)

        this.nodes = new Map<number, IntNode>()
        this.streams = new Set<Stream>()
        this.last_IntNode_uid = 0
        let node = new IntNode('Test IntNode', new Vec2(1.2, 2.4))
        node.IntPorts.push({"is_output": true, "name": "Testing a really really really long IntPort name", "type": IntPortType.Events})
        node.IntPorts.push({"is_output": false, "name": "Events IntPort", "type": IntPortType.Events})
        node.IntPorts.push({"is_output": false, "name": "Scalar IntPort", "type": IntPortType.Scalar})
        node.IntPorts.push({"is_output": false, "name": "Metadata IntPort", "type": IntPortType.Metadata})
        node.IntPorts.push({"is_output": false, "name": "String IntPort", "type": IntPortType.String})
        node.IntPorts.push({"is_output": false, "name": "Style IntPort", "type": IntPortType.Style})
        this.nodes.set(0, node)

        this.redraw()
    }
}

export type PortColorsProp = {[key: string]: btypes.Color}

export namespace NodeEditor {
    export type Attrs = bprop.AttrsOf<Props>

    export type Props = {
        nodes: bprop.Property<{[key: string]: Node}>,
        port_colors: bprop.Property<PortColorsProp>
    }
}

export interface NodeEditor extends NodeEditor.Attrs {}

export class NodeEditor extends HTMLBox {
    static __name__ = "NodeEditor"
    static __module__ = "fluent.NodeEditor"

    static init_NodeEditor(): void {
        this.prototype.default_view = NodeEditorView

        this.define<NodeEditor.Props>(({Dict, Ref, Color}) => {
            return {
                nodes: [ Dict(Ref(Node)), {} ],
                port_colors: [ Dict(Color), {} ]
            }
    })
    }
}