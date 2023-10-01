from bokeh.models import ColumnDataSource
from bokeh.models.tools import PolyTool, Drag, Tap
import bokeh.core.properties as bp

class PolygonGateTool(PolyTool, Drag, Tap):
    ''' *toolbar icon*: |poly_draw_icon|
    The PolyDrawTool allows drawing, selecting and deleting ``Patches`` and
    ``MultiLine`` glyphs on one or more renderers by editing the underlying
    ``ColumnDataSource`` data. Like other drawing tools, the renderers that
    are to be edited must be supplied explicitly.
    The tool will modify the columns on the data source corresponding to the
    ``xs`` and ``ys`` values of the glyph. Any additional columns in the data
    source will be padded with the declared ``empty_value``, when adding a new
    point.
    If a ``vertex_renderer`` with an point-like glyph is supplied then the
    ``PolyDrawTool`` will use it to display the vertices of the multi-lines or
    patches on all supplied renderers. This also enables the ability to snap
    to existing vertices while drawing.
    The supported actions include:
    * Add patch or multi-line: Double tap to add the first vertex, then use tap
      to add each subsequent vertex, to finalize the draw action double tap to
      insert the final vertex or press the <<esc> key.
    * Move patch or ulti-line: Tap and drag an existing patch/multi-line, the
      point will be dropped once you let go of the mouse button.
    * Delete patch or multi-line: Tap a patch/multi-line to select it then
      press <<backspace>> key while the mouse is within the plot area.
    .. |poly_draw_icon| image:: /_images/icons/PolyDraw.png
        :height: 24px
    '''
    __view_module__ = "cydnus"

    drag = bp.Bool(default=True, help="""
    Enables dragging of existing patches and multi-lines on pan events.
    """)