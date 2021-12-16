import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {canvas} from "@bokehjs/core/dom"
import * as bprop from "@bokehjs/core/properties"
import * as btypes from "@bokehjs/core/types"
import * as r from "./Renderer"

import {Node} from "./NodeModels"

// Following the example of
// https://github.com/bokeh/bokeh/blob/35c49c5865d574601bcd4627484905a4071366a0/bokehjs/src/lib/core/bokeh_events.ts#L9

// CONSTANT COLORS
const COLOR_STREAM: string = "white"
//


enum UIStatusMode {
    Default,
    NodeDragging,
}
/*
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
*/

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


class UIStatus {
    mode: UIStatusMode
    isCanvasDragging: boolean
    origin: Vec2
    scale: number
    selectedNodes: Set<string>
    lastMouseDrawLoc: Vec2

    constructor() {
        this.mode = UIStatusMode.Default
        this.isCanvasDragging = false
        this.origin = {x: 0, y: 0}
        this.scale = 1.0
        this.selectedNodes = new Set<string>()
        this.lastMouseDrawLoc = {x: 0, y: 0}
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
    model: NodeEditor

    canvas: HTMLCanvasElement
    draw_ctx: CanvasRenderingContext2D | null
    ui_status: UIStatus
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
        const ctx: CanvasRenderingContext2D | null = this.draw_ctx
        if (ctx) {
            const mouseCanvasLoc: Vec2 = this.getMouseCanvasLoc(ev)

            switch (ev.button) {
                case 0: {
                    // Check each node to see if we are selecting it
                    let lastNode: string | undefined
                    Object.entries(this.model.nodes).forEach((val: [string, Node]) => {
                        if (r.inNode(ctx, val[1], mouseCanvasLoc)) {
                            console.log("Node ", val[0], " selected!")
                            lastNode = val[0]
                        }
                    })

                    // Deselect all nodes if we didn't click a node
                    if (!lastNode) {
                        this.ui_status.selectedNodes.clear()
                    }

                    if (this.ui_status.mode == UIStatusMode.Default && lastNode) {
                        // If we aren't holding shift and we clicked a previously unselected
                        // item, clear the node list
                        if (!ev.shiftKey && !this.ui_status.selectedNodes.has(lastNode)) {
                            this.ui_status.selectedNodes.clear()
                        }

                        // Now add the node to the selection list
                        if (!this.ui_status.selectedNodes.has(lastNode)) {
                            this.ui_status.selectedNodes.add(lastNode)
                        }

                        // Enter dragging mode if we have nodes selected
                        if (this.ui_status.selectedNodes.size > 0) {
                            this.ui_status.mode = UIStatusMode.NodeDragging
                        }
                    }
                    this.redraw()
                    /*
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
                    */
                    break
                }
                case 1: {
                    this.ui_status.isCanvasDragging = true
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
            //const mouseCanvasLoc: Vec2 = this.getMouseCanvasLoc(ev)
            switch (ev.button) {
                case 0: {
                    this.ui_status.mode = UIStatusMode.Default
                    this.redraw()

                    /*
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
                    */
                    break
                }
                case 1: {
                    this.ui_status.isCanvasDragging = false
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
        // Skip all actions if we are canvas dragging
        if (this.ui_status.isCanvasDragging) {
            this.ui_status.origin.x += ev.movementX
            this.ui_status.origin.y += ev.movementY
            this.redraw()
            return
        }
        switch (this.ui_status.mode) {
            /*
            case UIStatusMode.PortDrawing: {
                this.ui_status.lastMouseDrawLoc = this.getMouseDrawLoc(ev)
                this.redraw()
                break
            }
            */
            case UIStatusMode.NodeDragging: {
                for (const id of this.ui_status.selectedNodes) {
                    const node = this.model.nodes[id]
                    node.location.x += ev.movementX / this.ui_status.scale
                    node.location.y += ev.movementY / this.ui_status.scale
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
            const ctx: CanvasRenderingContext2D = this.draw_ctx
            const scale = this.ui_status.scale
            const origin = this.ui_status.origin

            // Clear by clearing/setting transform
            this.draw_ctx.setTransform(1,0,0,1,0,0)
            this.draw_ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
            this.draw_ctx.setTransform(scale, 0, 0, scale, origin.x, origin.y)

            r.renderGrid(this.draw_ctx, this.ui_status, 25,     1.0, '#131313')
            r.renderGrid(this.draw_ctx, this.ui_status, 25 * 5, 2.0, '#131313')

            // Draw streams
            this.draw_ctx.save()
            this.draw_ctx.lineWidth = 3
            this.draw_ctx.strokeStyle = COLOR_STREAM
                /*
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
                */
            this.draw_ctx.restore()
            // Draw IntNodes
            this.model.nodes
            
            
            Object.entries(this.model.nodes).forEach((val: [string, Node]) => {
                r.renderNode(ctx, this.model.port_colors, val[1],
                             val[1].location,
                             this.ui_status.selectedNodes.has(val[0]))
            })

            // Draw stream in progress
            /*
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
            */

            // Draw status bar
            r.renderStatusbar(this.draw_ctx, "fluentjs-v0.0.1")
        }
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
        this.canvas.style.fontKerning = "normal"
        this.canvas.style.textRendering = "optimizelegibility"
        
        this.draw_ctx = this.canvas.getContext("2d")
        this.el.appendChild(this.canvas)

        this.streams = new Set<Stream>()
        this.last_IntNode_uid = 0
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