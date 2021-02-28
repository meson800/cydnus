import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {canvas} from "@bokehjs/core/dom"

// CONSTANT COLORS
const COLOR_NODE_INTERIOR: string = "rgba(90, 90, 90, 0.75)"
const COLOR_NODE_TITLE: string = "rgba(50, 50, 50, 0.75)"
const COLOR_NODE_SHADOW: string = "rgba(0,0,0,0)"
const COLOR_NODE_HIGHLIGHT: string = "white"
const COLOR_STREAM: string = "white"
const PORT_COLORS: string[] = ["rgb(161, 161, 161)", "rgb(99, 199, 99)", "rgb(99, 99, 199)", "rgb(199, 199, 41)", "rgb(229, 139, 86)"]


enum UIStatusMode {
    None,
    CanvasDragging,
    NodeDragging,
    PortDrawing,
}
enum UIActionType {
    NA,
    Drag,
    Port,
    Internal
}

interface UIAction {
    type: UIActionType
    port_id?: number
}

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

interface Stream {
    out_node: number,
    out_port: number,
    in_node: number,
    in_port: number
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
    selected_nodes: Set<number>
    lastMouseDrawLoc: Vec2
    lastPortNode: number
    lastPort: number

    constructor() {
        this.mode = UIStatusMode.None
        this.origin = {x: 0, y: 0}
        this.scale = 1.0
        this.selected_nodes = new Set<number>()
        this.lastMouseDrawLoc = {x: 0, y: 0}
        this.lastPortNode = 0
        this.lastPort = 0
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
     * @param isSelected If the node is currently selected.
     */
    draw(ctx: CanvasRenderingContext2D, isSelected: boolean) {

        const size: Vec2 = this.calculateSize(ctx)
        ctx.save()

        // Draw main node rectangle
        ctx.shadowBlur = 12
        ctx.shadowColor = 'black'
        ctx.shadowOffsetY = 7

        this.pathOutline(ctx, size)
        ctx.fillStyle = COLOR_NODE_INTERIOR
        ctx.fill()

        if (isSelected) {
            ctx.save()
            ctx.strokeStyle = COLOR_NODE_HIGHLIGHT
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()
        }

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

            const port_loc: Vec2 = this._getPortLocation(size, i)
            this.pathPort(ctx, size, i)
            ctx.fill()
            ctx.stroke()

            ctx.textAlign = port.is_output ? "right" : "left"
            ctx.textBaseline = "middle"
            ctx.fillStyle = "white"
            ctx.fillText(port.name, port_loc.x + (10 * (port.is_output ? -1 : 1)), port_loc.y)

        }
        ctx.restore()
    }

    pathOutline(ctx: CanvasRenderingContext2D, size: Vec2): void {
        pathRoundedRectangle(ctx, this.location.x, this.location.y, size.x, size.y, this.radius)
    }

    _getPortLocation(size: Vec2, port_idx: number): Vec2 {
        const port: Port = this.ports[port_idx]
        return new Vec2(
            this.location.x + (port.is_output ? size.x : 0),
            this.location.y + 25 + (port_idx * 2 * this.font_size))
    }

    getPortLocation(ctx: CanvasRenderingContext2D, port_idx: number): Vec2 {
        return this._getPortLocation(this.calculateSize(ctx), port_idx)
    }

    pathPort(ctx: CanvasRenderingContext2D, size: Vec2, port_idx: number): void {
        if (port_idx >= 0 && port_idx < this.ports.length) {
            const port_loc = this._getPortLocation(size, port_idx)

            ctx.beginPath()
            ctx.arc(port_loc.x, port_loc.y, 5, 0, 2 * Math.PI)
            ctx.closePath()
        }
    }

    handleMouse(ctx: CanvasRenderingContext2D, screen_coords: Vec2) : UIAction {
        const size: Vec2 = this.calculateSize(ctx)

        // Check each of the ports:
        for (let i: number = 0; i < this.ports.length; i++) {
            this.pathPort(ctx, size, i)
            if (ctx.isPointInPath(screen_coords.x, screen_coords.y)) {
                return {'type': UIActionType.Port, 'port_id': i}
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
        this.ports.forEach((port: Port) => {
            max_width = Math.max(max_width, ctx.measureText(port.name).width)
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
    nodes: Map<number, Node>
    streams: Set<Stream>

    last_node_uid: number

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
                    // Check each node to see if we are selecting it
                    let lastAction: UIAction = {type: UIActionType.NA}
                    let lastId: number | undefined
                    for (const [id, node] of this.nodes) {
                        const action: UIAction = node.handleMouse(this.draw_ctx, mouseCanvasLoc)
                        if (action.type != UIActionType.NA) {
                            lastAction = action
                            lastId = id
                        }
                    }
                    // Deselect nodes if we didn't click a node
                    if (lastAction.type == UIActionType.NA) {
                        this.ui_status.selected_nodes.clear()
                    }

                    if (lastAction.type == UIActionType.Drag && lastId != undefined) {
                        // Check status. First, if we are NOT holding shift and we clicked
                        // a previously unselected item, we should clear the selected node list
                        if (!ev.shiftKey && !this.ui_status.selected_nodes.has(lastId)) {
                            this.ui_status.selected_nodes.clear()
                        }
                        
                        // Add this node to the selected list if it isn't already:
                        if (!this.ui_status.selected_nodes.has(lastId)) {
                            this.ui_status.selected_nodes.add(lastId)
                        }

                        // If we have > 0 selected nodes, go into drag mode
                        if (this.ui_status.selected_nodes.size > 0) {
                            this.ui_status.mode = UIStatusMode.NodeDragging
                        }
                    } else if (lastAction.type == UIActionType.Port && lastId != undefined &&
                        lastAction.port_id != undefined) {
                        // Start drawing :)
                        this.ui_status.mode = UIStatusMode.PortDrawing
                        this.ui_status.lastMouseDrawLoc = this.getMouseDrawLoc(ev)

                        const select_node = this.nodes.get(lastId)
                        if (select_node && lastAction.port_id >= 0 && lastAction.port_id < select_node.ports.length) {
                            this.ui_status.lastPortNode = lastId
                            this.ui_status.lastPort = lastAction.port_id
                            // If this is an input node, disconnect the stream if it exists
                            if (!select_node.ports[lastAction.port_id].is_output) {
                                let prior_stream: Stream | undefined = undefined
                                this.streams.forEach(stream => {
                                    if (stream.in_node == lastId && stream.in_port == lastAction.port_id) {
                                        prior_stream = stream
                                        this.ui_status.lastPortNode = stream.out_node
                                        this.ui_status.lastPort = stream.out_port
                                    }

                                    if (stream.out_node == lastId && stream.out_port == lastAction.port_id) {
                                        prior_stream = stream
                                        this.ui_status.lastPortNode = stream.in_node
                                        this.ui_status.lastPort = stream.in_port
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

                    if (this.ui_status.mode == UIStatusMode.PortDrawing) {
                        // Check to see if we can complete a stream
                        let lastAction: UIAction = {type: UIActionType.NA}
                        let lastId: number | undefined
                        for (const [id, node] of this.nodes) {
                            const action: UIAction = node.handleMouse(this.draw_ctx, mouseCanvasLoc)
                            if (action.type != UIActionType.NA) {
                                lastAction = action
                                lastId = id
                            }
                        }

                        if (lastAction.type == UIActionType.Port && lastId != undefined && lastAction.port_id != undefined) {
                            const stream: Stream = {
                                'in_node': this.ui_status.lastPortNode,
                                'in_port': this.ui_status.lastPort,
                                'out_node': lastId,
                                'out_port': lastAction.port_id
                            }

                            const in_node = this.nodes.get(stream.in_node)
                            const out_node = this.nodes.get(stream.out_node)
                            if (in_node && out_node
                                && stream.in_port >= 0 && stream.in_port < in_node.ports.length
                                && stream.out_port >= 0 && stream.out_port < out_node.ports.length) {
                                    const in_port = in_node.ports[stream.in_port]
                                    const out_port = out_node.ports[stream.out_port]

                                    if (stream.in_node != stream.out_node
                                        && in_port.is_output != out_port.is_output
                                        && in_port.type == out_port.type) {
                                        
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
            case UIStatusMode.PortDrawing: {
                this.ui_status.lastMouseDrawLoc = this.getMouseDrawLoc(ev)
                this.redraw()
                break
            }
            case UIStatusMode.NodeDragging: {
                for (const id of this.ui_status.selected_nodes) {
                    const node = this.nodes.get(id)
                    if (node) {
                        node.location.x += ev.movementX / this.ui_status.scale
                        node.location.y += ev.movementY / this.ui_status.scale
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
                const in_node = this.nodes.get(stream.in_node)
                const out_node = this.nodes.get(stream.out_node)
                if(in_node && out_node) {
                    if (stream.in_port >= 0 && stream.out_port >= 0 &&
                        stream.in_port < in_node.ports.length &&
                        stream.out_port < out_node.ports.length) {
                        const in_loc: Vec2 = in_node.getPortLocation(this.draw_ctx, stream.in_port)
                        const out_loc: Vec2 = out_node.getPortLocation(this.draw_ctx, stream.out_port)
                        this.draw_ctx.beginPath()
                        this.draw_ctx.moveTo(in_loc.x, in_loc.y)
                        this.draw_ctx.lineTo(out_loc.x, out_loc.y)
                        this.draw_ctx.stroke()
                    }

                }
            }
            this.draw_ctx.restore()
            // Draw nodes
            for (const [id, node] of this.nodes) {
                node.draw(this.draw_ctx, this.ui_status.selected_nodes.has(id))
            }

            // Draw stream in progress
            if (this.ui_status.mode == UIStatusMode.PortDrawing) {
                const in_node = this.nodes.get(this.ui_status.lastPortNode)
                if (in_node && this.ui_status.lastPort >= 0 && this.ui_status.lastPort < in_node.ports.length) {
                    const in_loc: Vec2 = in_node.getPortLocation(this.draw_ctx, this.ui_status.lastPort)
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

        this.nodes = new Map<number, Node>()
        this.streams = new Set<Stream>()
        this.last_node_uid = 0
        let node = new Node('Test node', new Vec2(1.2, 2.4))
        node.ports.push({"is_output": true, "name": "Testing a really really really long port name", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Events port", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Scalar port", "type": PortType.Scalar})
        node.ports.push({"is_output": false, "name": "Metadata port", "type": PortType.Metadata})
        node.ports.push({"is_output": false, "name": "String port", "type": PortType.String})
        node.ports.push({"is_output": false, "name": "Style port", "type": PortType.Style})
        this.nodes.set(0, node)
        node = new Node('FCS input', new Vec2(150, 120))
        node.ports.push({"is_output": true, "name": "FCS events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Name: test_input_1.fcs", "type": PortType.String})
        this.nodes.set(1, node)
        node = new Node('FCS input', new Vec2(150, 220))
        node.ports.push({"is_output": true, "name": "FCS events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Name: test_input_2.fcs", "type": PortType.String})
        this.nodes.set(2, node)
        node = new Node('FCS input', new Vec2(150, 320))
        node.ports.push({"is_output": true, "name": "FCS events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Name: test_input_3.fcs", "type": PortType.String})
        this.nodes.set(3, node)
        node = new Node('Event union', new Vec2(250, 120))
        node.ports.push({"is_output": true, "name": "Combined events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Events", "type": PortType.Events})
        this.nodes.set(4, node)
        node = new Node('Reduction gate', new Vec2(350, 200))
        node.ports.push({"is_output": true, "name": "Gated events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Type: Polygon", "type": PortType.String})
        node.ports.push({"is_output": false, "name": "Axis: FCS-A", "type": PortType.String})
        node.ports.push({"is_output": false, "name": "Axis: SSC-A", "type": PortType.String})
        this.nodes.set(5, node)
        node = new Node('Density scatter', new Vec2(450, 120))
        node.ports.push({"is_output": false, "name": "Events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Axis: FCS-A", "type": PortType.String})
        node.ports.push({"is_output": false, "name": "Axis: SSC-A", "type": PortType.String})
        node.ports.push({"is_output": false, "name": "Style", "type": PortType.Style})
        this.nodes.set(6, node)
        node = new Node('Histogram', new Vec2(450, 140))
        node.ports.push({"is_output": false, "name": "Events", "type": PortType.Events})
        node.ports.push({"is_output": false, "name": "Axis: RFP-A", "type": PortType.String})
        node.ports.push({"is_output": false, "name": "Style", "type": PortType.Style})
        this.nodes.set(7, node)
        node = new Node('Plot style', new Vec2(300, 320))
        node.ports.push({"is_output": true, "name": "Loaded style", "type": PortType.Style})
        node.ports.push({"is_output": false, "name": "Style name: nature", "type": PortType.String})
        this.nodes.set(8, node)


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