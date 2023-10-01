import {Node, Port} from "./NodeModels"
import {Color} from "@bokehjs/core/types"
import {color2css} from "@bokehjs/core/util/color"
import { Canvas } from "@bokeh/bokehjs"
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
 * @param x The x coordinate of the upper left corner of the rounded rectangle
 * @param y The y coordinate of the upper left corner of the rounded rectangle
 * @param width The width of the rectangle
 * @param height The height of the rectangle
 * @param radius The radius of the rounded corners
 */
function pathRoundedRectangle(x: number, y: number,
    width: number, height: number, radius: number): Path2D {
        // Start in upper left corner
        const result: Path2D = new Path2D()
        result.moveTo(x, y + radius)
        result.quadraticCurveTo(x, y, x + radius, y)
        result.lineTo(x + width - radius, y)
        result.quadraticCurveTo(x + width, y, x + width, y + radius)
        result.lineTo(x + width, y + height - radius)
        result.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        result.lineTo(x + radius, y + height)
        result.quadraticCurveTo(x, y + height, x, y + height - radius)
        result.closePath()
        return result
}

function pathUpperRoundedRectangle(x: number, y: number,
    width: number, height: number, radius: number): Path2D {
        // Start in upper left corner
        const result: Path2D = new Path2D()
        result.moveTo(x, y + radius)
        result.quadraticCurveTo(x, y, x + radius, y)
        result.lineTo(x + width - radius, y)
        result.quadraticCurveTo(x + width, y, x + width, y + radius)
        result.lineTo(x + width, y + height)
        result.lineTo(x, y + height)
        result.closePath()
        return result
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
    handleMouseDown(_ev: MouseEvent, _loc:Vec2, _ctx:CanvasRenderingContext2D): boolean {return false}
    handleMouseUp(_ev: MouseEvent, _loc:Vec2, _ctx:CanvasRenderingContext2D): boolean {return false}
    handleMouseMove(_ev: MouseEvent, _loc:Vec2, _ctx:CanvasRenderingContext2D): boolean {return false}
    handleWheel(_ev: WheelEvent, _loc:Vec2, _ctx:CanvasRenderingContext2D): boolean {return false}

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
    handleMouseDownHelper(ev: MouseEvent, loc:Vec2, ctx: CanvasRenderingContext2D): boolean {
        ctx.translate(this.location.x, this.location.y)
        for (var child of this.children) {
            if (child.handleMouseDownHelper(ev, loc, ctx)) {
                ctx.translate(-this.location.x, -this.location.y)
                return true
            }
        }
        const result:boolean = this.handleMouseDown(ev, loc, ctx)
        ctx.translate(-this.location.x, -this.location.y)
        return result
    }
    handleMouseUpHelper(ev: MouseEvent, loc:Vec2, ctx: CanvasRenderingContext2D): boolean {
        ctx.translate(this.location.x, this.location.y)
        for (var child of this.children) {
            if (child.handleMouseUpHelper(ev, loc, ctx)) {
                ctx.translate(-this.location.x, -this.location.y)
                return true
            }
        }
        const result:boolean = this.handleMouseUp(ev, loc, ctx)
        ctx.translate(-this.location.x, -this.location.y)
        return result
    }
    handleMouseMoveHelper(ev: MouseEvent, loc:Vec2, ctx:CanvasRenderingContext2D): boolean {
        ctx.translate(this.location.x, this.location.y)
        for (var child of this.children) {
            if (child.handleMouseMoveHelper(ev, loc, ctx)) {
                ctx.translate(-this.location.x, -this.location.y)
                return true
            }
        }
        const result:boolean = this.handleMouseMove(ev, loc, ctx)
        ctx.translate(-this.location.x, -this.location.y)
        return result

    }
    handleWheelHelper(ev: WheelEvent, loc:Vec2, ctx:CanvasRenderingContext2D): boolean {
        ctx.translate(this.location.x, this.location.y)
        for (var child of this.children) {
            if (child.handleWheelHelper(ev, loc, ctx)) {
                ctx.translate(-this.location.x, -this.location.y)
                return true
            }
        }
        const result:boolean = this.handleWheel(ev, loc, ctx)
        ctx.translate(-this.location.x, -this.location.y)
        return result
    }
}

export class NodeElement extends RenderedElement {
    name: string
    width: number
    selected: boolean
    updateLocationCallback: (x: number, y: number)=>void
    bodyPath: Path2D

    constructor(location: Vec2, name: string, selected: boolean, updateLocationCallback: (x: number, y: number)=> void) {
        super(location)
        this.name = name
        this.width = 100
        this.selected = selected
        this.updateLocationCallback = updateLocationCallback
    }
    preDraw(ctx: CanvasRenderingContext2D): void {
        const height: number = 25 + (this.children.length * NODE_FONT_SIZE * 2)
        // Draw main IntNode rectangle
        ctx.shadowBlur = 12
        ctx.shadowColor = 'black'
        ctx.shadowOffsetY = 7

        this.bodyPath = pathRoundedRectangle(0, 0, this.width, height, NODE_RADIUS)
        ctx.fillStyle = COLOR_IntNode_INTERIOR
        ctx.fill(this.bodyPath)

        if (this.selected) {
            ctx.strokeStyle = COLOR_IntNode_HIGHLIGHT
            ctx.lineWidth = 1
            ctx.stroke(this.bodyPath)
        }

        ctx.shadowBlur = 0
        ctx.shadowColor = COLOR_IntNode_SHADOW
        ctx.shadowOffsetY = 0

        ctx.fillStyle = COLOR_IntNode_TITLE
        ctx.fill(pathUpperRoundedRectangle(0, 0, this.width, 14, NODE_RADIUS))

        // Draw text
        ctx.font = `${NODE_FONT_SIZE}px sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"
        ctx.fillStyle = "white"
        ctx.fillText(this.name, NODE_RADIUS, NODE_FONT_SIZE + 1)

    }
    postDraw(_: CanvasRenderingContext2D): void {}
    //handleMouseDown(_ev: MouseEvent, _ctx:CanvasRenderingContext2D): boolean {return false}
    //handleMouseUp(_ev: MouseEvent, _ctx:CanvasRenderingContext2D): boolean {return false}
    //handleMouseMove(_ev: MouseEvent, _ctx:CanvasRenderingContext2D): boolean {return false}
    //handleWheel(_ev: WheelEvent, _ctx:CanvasRenderingContext2D): boolean {return false}
}

export class PortElement extends RenderedElement {
    streamStartCallback: ()=>void
    streamEndCallback: ()=>void
    name: string
    width: number
    isInput: boolean
    portColor: Color
    nodePath: Path2D
    constructor(location: Vec2, width: number, streamStartCb:()=>void, streamEndCb:()=>void, portName: string, isInput: boolean, portColor: Color) {
        super(location)
        this.name = portName
        this.width = width
        this.streamStartCallback = streamStartCb
        this.streamEndCallback = streamEndCb
        this.isInput = isInput
        this.portColor = portColor
    }
    preDraw(_: CanvasRenderingContext2D): void {}
    postDraw(ctx: CanvasRenderingContext2D): void {
        const x: number = this.isInput ? 0 : this.width
        this.nodePath = new Path2D()
        this.nodePath.arc(x, 15, 5, 0, 2 * Math.PI)
        this.nodePath.closePath()
        
        ctx.fill(this.nodePath)
        ctx.stroke(this.nodePath)

        ctx.textAlign = this.isInput ? "left" : "right"
        ctx.textBaseline = "middle"
        ctx.fillStyle = "white"
        ctx.fillText(this.name,x + 10, 15)
    }
    handleMouseDown(_: MouseEvent, loc:Vec2, ctx:CanvasRenderingContext2D): boolean {
        if (ctx.isPointInPath(this.nodePath, loc.x, loc.y)) {
            this.streamStartCallback()
            return true
        }
        return false
    }
    handleMouseUp(_: MouseEvent, loc:Vec2, ctx:CanvasRenderingContext2D): boolean {
        if (ctx.isPointInPath(this.nodePath, loc.x, loc.y)) {
            this.streamEndCallback()
            return true
        }
        return false
    }
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