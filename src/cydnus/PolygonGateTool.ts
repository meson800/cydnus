import type {UIEvent, PanEvent, TapEvent, MoveEvent, KeyEvent} from "@bokehjs/core/ui_events"
import type * as p from "@bokehjs/core/properties"
import {isArray} from "@bokehjs/core/util/types"
import type {MultiLine} from "@bokehjs/models/glyphs/multi_line"
import type {Patches} from "@bokehjs/models/glyphs/patches"
import type {GlyphRenderer} from "@bokehjs/models/renderers/glyph_renderer"
import {PolyTool, PolyToolView} from "@bokehjs/models/tools/edit/poly_tool"
import {tool_icon_poly_draw} from "@bokehjs/styles/icons.css"

export interface HasPolyGlyph {
  glyph: MultiLine | Patches
}

export class PolygonGateToolView extends PolyToolView {
  declare model: PolygonGateTool
  _drawing: boolean = false
  _initialized: boolean = false

  override _tap(ev: TapEvent): void {
    if (this._drawing)
      this._draw(ev, "add", true)
    else
      this._select_event(ev, this._select_mode(ev), this.model.renderers)
  }

  _draw(ev: UIEvent, mode: string, emit: boolean = false): void {
    const renderer = this.model.renderers[0]
    const point = this._map_drag(ev.sx, ev.sy, renderer)

    if (!this._initialized)
      this.activate() // Ensure that activate has been called

    if (point == null)
      return

    const [x, y] = this._snap_to_vertex(ev, ...point)

    const cds = renderer.data_source
    const glyph: any = renderer.glyph
    const [xkey, ykey] = [glyph.xs.field, glyph.ys.field]
    if (mode == "new") {
      this._pop_glyphs(cds, this.model.num_objects)
      if (xkey) cds.get_array(xkey).push([x, x])
      if (ykey) cds.get_array(ykey).push([y, y])
      this._pad_empty_columns(cds, [xkey, ykey])
    } else if (mode == "edit") {
      if (xkey) {
        const xs = cds.data[xkey][cds.data[xkey].length-1]
        xs[xs.length-1] = x
      }
      if (ykey) {
        const ys = cds.data[ykey][cds.data[ykey].length-1]
        ys[ys.length-1] = y
      }
    } else if (mode == "add") {
      if (xkey) {
        const xidx = cds.data[xkey].length-1
        let xs = cds.get_array<number[]>(xkey)[xidx]
        const nx = xs[xs.length-1]
        xs[xs.length-1] = x
        if (!isArray(xs)) {
          xs = Array.from(xs)
          cds.data[xkey][xidx] = xs
        }
        xs.push(nx)
      }
      if (ykey) {
        const yidx = cds.data[ykey].length-1
        let ys = cds.get_array<number[]>(ykey)[yidx]
        const ny = ys[ys.length-1]
        ys[ys.length-1] = y
        if (!isArray(ys)) {
          ys = Array.from(ys)
          cds.data[ykey][yidx] = ys
        }
        ys.push(ny)
      }
    }
    this._emit_cds_changes(cds, true, false, emit)
  }

  _show_vertices(): void {
    if (!this.model.active) { return }
    const xs: number[] = []
    const ys: number[] = []
    for (let i=0; i<this.model.renderers.length; i++) {
      const renderer = this.model.renderers[i]
      const cds = renderer.data_source
      const glyph: any = renderer.glyph
      const [xkey, ykey] = [glyph.xs.field, glyph.ys.field]
      if (xkey) {
        for (const array of cds.get_array<number[]>(xkey)) {
          xs.push(...array)
        }
      }
      if (ykey) {
        for (const array of cds.get_array<number[]>(ykey)) {
          ys.push(...array)
        }
      }
      if (this._drawing && (i == (this.model.renderers.length-1))) {
        // Skip currently drawn vertex
        xs.splice(xs.length-1, 1)
        ys.splice(ys.length-1, 1)
      }
    }
    this._set_vertices(xs, ys)
  }

  override _doubletap(ev: TapEvent): void {
    if (!this.model.active)
      return
    if (this._drawing) {
      this._drawing = false
      this._draw(ev, "edit", true)
    } else {
      this._drawing = true
      this._draw(ev, "new", true)
    }
  }

  override _move(ev: MoveEvent): void {
    if (this._drawing) {
      this._draw(ev, "edit")
    }
  }

  _remove(): void {
    const renderer = this.model.renderers[0]
    const cds = renderer.data_source
    const glyph: any = renderer.glyph
    const [xkey, ykey] = [glyph.xs.field, glyph.ys.field]
    if (xkey) {
      const xidx = cds.data[xkey].length-1
      const xs = cds.get_array<number[]>(xkey)[xidx]
      xs.splice(xs.length-1, 1)
    }
    if (ykey) {
      const yidx = cds.data[ykey].length-1
      const ys = cds.get_array<number[]>(ykey)[yidx]
      ys.splice(ys.length-1, 1)
    }
    this._emit_cds_changes(cds)
  }

  override _keyup(ev: KeyEvent): void {
    if (!this.model.active || !this._mouse_in_frame)
      return
    for (const renderer of this.model.renderers) {
      if (ev.key == "Backspace") {
        this._delete_selected(renderer)
      } else if (ev.key == "Escape") {
        if (this._drawing) {
          this._remove()
          this._drawing = false
        }
        renderer.data_source.selection_manager.clear()
      }
    }
  }

  override _pan_start(ev: PanEvent): void {
    if (!this.model.drag)
      return
    this._select_event(ev, "append", this.model.renderers)
    this._basepoint = [ev.sx, ev.sy]
  }

  override _pan(ev: PanEvent): void {
    if (this._basepoint == null || !this.model.drag)
      return
    const [bx, by] = this._basepoint
    // Process polygon/line dragging
    for (const renderer of this.model.renderers) {
      const basepoint = this._map_drag(bx, by, renderer)
      const point = this._map_drag(ev.sx, ev.sy, renderer)
      if (point == null || basepoint == null)
        continue

      const cds = renderer.data_source
      // Type once dataspecs are typed
      const glyph: any = renderer.glyph
      const [xkey, ykey] = [glyph.xs.field, glyph.ys.field]
      if (!xkey && !ykey)
        continue
      const [x, y] = point
      const [px, py] = basepoint
      const [dx, dy] = [x-px, y-py]
      for (const index of cds.selected.indices) {
        let length, xs, ys
        if (xkey) xs = cds.data[xkey][index]
        if (ykey) {
          ys = cds.data[ykey][index]
          length = ys.length
        } else {
          length = xs.length
        }
        for (let i = 0; i < length; i++) {
          if (xs) xs[i] += dx
          if (ys) ys[i] += dy
        }
      }
      cds.change.emit()
    }
    this._basepoint = [ev.sx, ev.sy]
  }

  override _pan_end(ev: PanEvent): void {
    if (!this.model.drag)
      return
    this._pan(ev)
    for (const renderer of this.model.renderers)
      this._emit_cds_changes(renderer.data_source)
    this._basepoint = null
  }

  override activate(): void {
    console.log("Dropping doubletap failure")
    this.plot_view.canvas.ui_event_bus['hammer'].get("tap").dropRequireFailure("doubletap")
    console.log(this.plot_view.canvas.ui_event_bus['hammer'].get("tap"))
    this.plot_view.canvas.ui_event_bus['hammer'].get("tap").options.threshold = 1000
    if (this.model.vertex_renderer == null || !this.model.active)
      return
    this._show_vertices()
    if (!this._initialized) {
      for (const renderer of this.model.renderers) {
        const cds = renderer.data_source
        cds.connect(cds.properties.data.change, () => this._show_vertices())
      }
    }
    this._initialized = true
  }

  override deactivate(): void {
    if (this._drawing) {
      this._remove()
      this._drawing = false
    }
    if (this.model.vertex_renderer != null) {
      this._hide_vertices()
    }
    console.log("Adding doubletap failure again")
    this.plot_view.canvas.ui_event_bus['hammer'].get("tap").requireFailure("doubletap")
  }
}

export namespace PolygonGateTool {
  export type Attrs = p.AttrsOf<Props>

  export type Props = PolyTool.Props & {
    drag: p.Property<boolean>
    num_objects: p.Property<number>
  }
}

export interface PolygonGateTool extends PolygonGateTool.Attrs {}

export class PolygonGateTool extends PolyTool {
  declare properties: PolygonGateTool.Props
  declare __view_type__: PolygonGateToolView

  declare renderers: (GlyphRenderer & HasPolyGlyph)[]

  constructor(attrs?: Partial<PolygonGateTool.Attrs>) {
    super(attrs)
  }

  static override __module__ = "cydnus"

  static {
    this.prototype.default_view = PolygonGateToolView

    this.define<PolygonGateTool.Props>(({Boolean, Int}) => ({
      drag:        [ Boolean, true ],
      num_objects: [ Int, 0 ],
    }))
  }

  override tool_name = "Polygon Gate Tool"
  override tool_icon = tool_icon_poly_draw
  override event_type = ["pan" as "pan", "tap" as "tap", "move" as "move"]
  override default_order = 3
}