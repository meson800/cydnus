import {Node, Port} from "./NodeModels"
import {Color} from "@bokehjs/core/types"
import {color2css} from "@bokehjs/core/util/color"
/**
 * A series of *state-independent* rendering definitions.
 * These render functions are expected to be given all of the information
 * needed to render, in order to not hide any internal state.
 */

/**
 * Grid location/status/conversion functions
 */
export interface Vec2 {
    x: number,
    y: number
}

export interface BoundingBox {
    origin: Vec2
    width: number
    height: number
}

export interface RenderRegion {
    origin: Vec2
    scale: number
}

/********************************************************************************
 * 
 * Helper interface and type definitions
 * 
 ********************************************************************************/

type ColorMap = {
    [key: string] : Color
}

/**
 * Interface representing a drawn port
 */
interface PortUI {
    
}

/**
 * Draw commands return DrawElement's
 */
interface DrawElement {
    inElement(screen_coord: Vec2) : boolean
    children: DrawElement[]
}

/**
 * Converts canvas/screen coordinates to drawing coordinates.
 * @param region A RenderRegion specifying the current render display
 * @param pos A position in canvas coordinates (e.g. mouse coords) to be converted
 * @returns A Vec2 representing a point in drawing space
 */
function canvasToDrawCoord(region: RenderRegion, pos: Vec2): Vec2 {
    return {
        x: (pos.x - region.origin.x) / region.scale,
        y: (pos.y - region.origin.y) / region.scale
    }
}

/**
 * Converts drawing coordinates to canvas/screen coordinates.
 * @param region A RenderRegion specifying the current render display
 * @param pos A position in drawing coordinates to be converted
 * @returns A Vec2 representing a point in canvas/screen space
 */
/*
function drawToCanvasCoord(region: RenderRegion, pos: Vec2) : Vec2 {
    return {
        x: (pos.x * region.scale) + region.origin.x,
        y: (pos.y * region.scale) + region.origin.y
    }
}
*/

/******************************************************************************
 * 
 * Drawing helper functions
 * 
 ******************************************************************************/

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

const COLOR_IntNode_INTERIOR: string = "rgba(90, 90, 90, 0.75)"
const COLOR_IntNode_TITLE: string = "rgba(50, 50, 50, 0.75)"
const COLOR_IntNode_SHADOW: string = "rgba(0,0,0,0)"
const COLOR_IntNode_HIGHLIGHT: string = "white"
//const COLOR_STREAM: string = "white"
const NODE_FONT_SIZE: number = 9
const NODE_RADIUS: number = 8

/***********************
 * 
 * Main 
 */

class RenderedElement {
    location: Vec2
    children: RenderedElement[]
    // Overridable functions that define the draw and mouse handling events.
    preDraw(_: CanvasRenderingContext2D): void {}
    postDraw(_: CanvasRenderingContext2D): void {}
    handleMouseDown(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleMouseUp(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleMouseMove(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleWheel(_ev: WheelEvent, _offset:Vec2): boolean {return false}

    // Helper recursive functions. Do not override!
    constructor(location: Vec2) {
        this.location = location
    }
    draw(ctx: CanvasRenderingContext2D): void {
        // Shift the coordinate system so that this element is at the origin
        ctx.translate(this.location.x, this.location.y)
        this.preDraw(ctx)
        for (var child of this.children) {
            child.draw(ctx)
        }
        this.postDraw(ctx)
        ctx.translate(-this.location.x, -this.location.y)
    }
    handleMouseDownHelper(ev: MouseEvent, offset:Vec2): boolean {
        for (var child of this.children) {
            if (child.handleMouseDownHelper(ev, {x: offset.x + child.location.x, y: offset.y + child.location.y})) {
                return true
            }
        }
        return this.handleMouseDown(ev, offset)
    }
    handleMouseUpHelper(ev: MouseEvent, offset:Vec2): boolean {
        for (var child of this.children) {
            if (child.handleMouseUpHelper(ev, {x: offset.x + child.location.x, y: offset.y + child.location.y})) {
                return true
            }
        }
        return this.handleMouseUp(ev, offset)

    }
    handleMouseMoveHelper(ev: MouseEvent, offset:Vec2): boolean {
        for (var child of this.children) {
            if (child.handleMouseMoveHelper(ev, {x: offset.x + child.location.x, y: offset.y + child.location.y})) {
                return true
            }
        }
        return this.handleMouseMove(ev, offset)

    }
    handleWheelHelper(ev: WheelEvent, offset:Vec2): boolean {
        for (var child of this.children) {
            if (child.handleWheelHelper(ev, {x: offset.x + child.location.x, y: offset.y + child.location.y})) {
                return true
            }
        }
        return this.handleWheel(ev, offset)
    }
}

class NodeElement extends RenderedElement {
    constructor(location: Vec2, updateLocationCallback: (x: number, y: number)=> void) {
        super(location)
    }
    preDraw(_: CanvasRenderingContext2D): void {}
    postDraw(_: CanvasRenderingContext2D): void {}
    handleMouseDown(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleMouseUp(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleMouseMove(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleWheel(_ev: WheelEvent, _offset:Vec2): boolean {return false}
}

class PortElement extends RenderedElement {
    constructor(location: Vec2, port_name: string, is_input: boolean) {
        super(location)
    }
    preDraw(_: CanvasRenderingContext2D): void {}
    postDraw(_: CanvasRenderingContext2D): void {}
    handleMouseDown(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleMouseUp(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleMouseMove(_ev: MouseEvent, _offset:Vec2): boolean {return false}
    handleWheel(_ev: WheelEvent, _offset:Vec2): boolean {return false}
}

class IntPortElement extends PortElement {
    
}

/*********************************************************************
 * 
 * Main rendering functions, to be called to draw on a desired canvas.
 * 
 *********************************************************************/

/**
 * 
 * @param ctx The drawing context for the canvas.
 * @param region Specifies the origin and scale of the backing grid.
 * @param spacing The spacing, in pixel units, between grid lines.
 * @param width The width, in pixel units, between grid lines.
 * @param color The color of the grid lines to draw.
 */
export function renderGrid(
    ctx: CanvasRenderingContext2D,
    region: RenderRegion,
    spacing: number,
    width: number,
    color: string): void
{
    const roundDown = (x: number): number => {
        return Math.min(x, Math.floor(x / spacing) * spacing)
    }
    const roundUp = (x: number): number => {
        return Math.max(x, Math.ceil(x / spacing) * spacing)
    }
    
    const upperLeft = canvasToDrawCoord(region, {x: 0, y: 0})
    const bottomRight = canvasToDrawCoord(region, {
        x: ctx.canvas.width,
        y: ctx.canvas.height
    })

    upperLeft.x = roundDown(upperLeft.x)
    upperLeft.y = roundDown(upperLeft.y)
    bottomRight.x = roundUp(bottomRight.x)
    bottomRight.y = roundUp(bottomRight.y)

    ctx.beginPath()
    for (var i: number = upperLeft.x; i < bottomRight.x; i += spacing) {
        ctx.moveTo(i, upperLeft.y)
        ctx.lineTo(i, bottomRight.y)
    }

    for (var j: number = upperLeft.y; j < bottomRight.y; j += spacing) {
        ctx.moveTo(upperLeft.x, j)
        ctx.lineTo(bottomRight.x, j)
    }
    // Stroke thin lines
    ctx.lineWidth = width
    ctx.strokeStyle = color
    ctx.stroke()
}

/**
 * Draws a statusbar at the bottom of the screen.
 * @param ctx The drawing context.
 * @param text Text to render in the lower left corner.
 */
export function renderStatusbar(ctx: CanvasRenderingContext2D, text: string) {
    ctx.save()
    ctx.setTransform(1,0,0,1,0,0)
    ctx.font = "11px sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "bottom"
    ctx.fillStyle = "white"
    ctx.fillText(text, 5, ctx.canvas.height)
    ctx.restore()
}

export function inPort(ctx: CanvasRenderingContext2D, node: Node, portIdx: number, c: Vec2): boolean {
    ctx.save()
    const nodeSize: Vec2 = calculateNodeSize(ctx, node)
    const port: Port = node.ports[portIdx]
    const portLoc: Vec2 = {
        x: node.location.x + (port.is_input ? 0 : nodeSize.x),
        y: node.location.y + 25 + (portIdx * 2 * NODE_FONT_SIZE)
    }
    ctx.beginPath()
    ctx.arc(portLoc.x, portLoc.y, 5, 0, 2 * Math.PI)
    ctx.closePath()
    const result = ctx.isPointInPath(c.x, c.y)
    ctx.restore()
    return result
}
export function inNode(ctx: CanvasRenderingContext2D, node: Node, c: Vec2): boolean {
    ctx.save()
    const nodeSize: Vec2 = calculateNodeSize(ctx, node)
    pathRoundedRectangle(ctx, node.location.x, node.location.y, nodeSize.x, nodeSize.y, NODE_RADIUS)
    const result = ctx.isPointInPath(c.x, c.y)
    ctx.restore()
    return result
}

function calculateNodeSize(ctx: CanvasRenderingContext2D, node: Node): Vec2 {
    ctx.save()
    ctx.font = `${NODE_FONT_SIZE}px sans-serif`
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"

    const titleWidth = ctx.measureText(node.node_name).width

    var maxWidth = titleWidth
    node.ports.forEach((port: Port) => {
        maxWidth = Math.max(maxWidth, ctx.measureText(port.port_name).width)
    })

    return {
        x: (maxWidth + NODE_RADIUS * 2) + 10,
        y: 25 + (NODE_FONT_SIZE * node.ports.length * 2)
    }
}

export function renderNode(
    ctx: CanvasRenderingContext2D,
    colorMap: ColorMap,
    node: Node,
    loc: Vec2,
    selected: boolean) : DrawElement {
    // Calculate overall size and locations of all ports.
    ctx.save()
    const nodeSize: Vec2 = calculateNodeSize(ctx, node)

    // Draw main IntNode rectangle
    ctx.shadowBlur = 12
    ctx.shadowColor = 'black'
    ctx.shadowOffsetY = 7

    pathRoundedRectangle(ctx, loc.x, loc.y, nodeSize.x, nodeSize.y, NODE_RADIUS)
    ctx.fillStyle = COLOR_IntNode_INTERIOR
    ctx.fill()

    if (selected) {
        ctx.save()
        ctx.strokeStyle = COLOR_IntNode_HIGHLIGHT
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
    }

    ctx.shadowBlur = 0
    ctx.shadowColor = COLOR_IntNode_SHADOW
    ctx.shadowOffsetY = 0

    pathUpperRoundedRectangle(ctx, loc.x, loc.y, nodeSize.x, 14, NODE_RADIUS)
    ctx.fillStyle = COLOR_IntNode_TITLE
    ctx.fill()

    // Draw text
    ctx.font = `${NODE_FONT_SIZE}px sans-serif`
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "white"
    ctx.fillText(node.node_name, loc.x + NODE_RADIUS, loc.y + NODE_FONT_SIZE + 1)

    const nodeElement:DrawElement = {
        inElement: (c: Vec2) => {
            ctx.save()
            pathRoundedRectangle(ctx, loc.x, loc.y, nodeSize.x, nodeSize.y, NODE_RADIUS)
            const result = ctx.isPointInPath(c.x, c.y)
            ctx.restore()
            return result
        },
        children: []
    }

    // Draw ports
    node.ports.forEach((port: Port, i: number) => {
        ctx.fillStyle = color2css(colorMap[port.datatype])
        ctx.strokeStyle = "black"
        ctx.lineWidth = 1

        const portLoc: Vec2 = {
            x: loc.x + (port.is_input ? 0 : nodeSize.x),
            y: loc.y + 25 + (i * 2 * NODE_FONT_SIZE)
        }
        ctx.beginPath()
        ctx.arc(portLoc.x, portLoc.y, 5, 0, 2 * Math.PI)
        ctx.closePath()

        nodeElement.children.push({
            inElement: (c: Vec2) => {
                ctx.save()
                ctx.beginPath()
                ctx.arc(portLoc.x, portLoc.y, 5, 0, 2 * Math.PI)
                ctx.closePath()
                const result = ctx.isPointInPath(c.x, c.y)
                ctx.restore()
                return result
            },
            children: []
        })

        ctx.fill()
        ctx.stroke()

        ctx.textAlign = port.is_input ? "left" : "right"
        ctx.textBaseline = "middle"
        ctx.fillStyle = "white"
        ctx.fillText(port.port_name,
            portLoc.x + (10 * (port.is_input ? 1 : -1)),
            portLoc.y)
    })
    ctx.restore()
    return nodeElement
}