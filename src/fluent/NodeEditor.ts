import {HTMLBox, HTMLBoxView} from "@bokehjs/models/layouts/html_box"
import {canvas} from "@bokehjs/core/dom"

export class NodeEditorView extends HTMLBoxView {

    canvas: HTMLCanvasElement
    draw_ctx: CanvasRenderingContext2D | null

    connect_signals(): void {
        super.connect_signals()
    }

    render(): void {
        super.render()

        this.canvas = canvas({
      style: {
        padding: '2px',
        backgroundColor: '#ffffff',
      },
      width: 500,
      height: 400
    })
        this.draw_ctx = this.canvas.getContext("2d")
        this.el.appendChild(this.canvas)
        if (this.draw_ctx) {
            this.draw_ctx.moveTo(0,0)
            this.draw_ctx.lineTo(100,10)
            this.draw_ctx.stroke()
        }
    }
}

export class NodeEditor extends HTMLBox {
    static __name__ = "NodeEditor"
    static __module__ = "fluent.NodeEditor"

    static init_NodeEditor(): void {
        this.prototype.default_view = NodeEditorView
    }
}