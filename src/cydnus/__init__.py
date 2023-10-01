import panel as pn
import holoviews as hv
from holoviews.operation.datashader import datashade
import libfcs.events
import libfcs.gates
import libfcs.transforms
import libfcs._libfcs_ext

from bokeh.core.properties import Instance
from bokeh.models import ColumnDataSource, Tool
from bokeh.util.compiler import TypeScript

import numpy as np
import pandas as pd

def notebook_init(verbose: bool = False):
   pn.extension() 
   if verbose:
    print(f"Panel comms: {pn.config.comms}")

class PolygonGateSelector:
    x_transform: libfcs.transforms.UnidimensionalTransform
    y_transform: libfcs.transforms.UnidimensionalTransform
    event_data: pd.DataFrame
    polygons: hv.Polygons
    poly_stream: hv.streams.PolyDraw
    draw_source: ColumnDataSource

    # TODO: relax the unidimensional assumption, to get a generic "transform name"
    def __init__(self, x: libfcs.transforms.UnidimensionalTransform, y: libfcs.transforms.UnidimensionalTransform, *, events: libfcs.events.FlowEvents):
        self.x_transform = x
        self.y_transform = y
        print()
        self.event_data = pd.DataFrame(np.column_stack([
            self.x_transform.transform_df(events.events),
            self.y_transform.transform_df(events.events)
            ]), columns=[self.x_transform.x_param, self.y_transform.x_param]
        )
        self.polygons = hv.Polygons([[(0,0)]])
        self.poly_stream = hv.streams.PolyEdit(source=self.polygons, drag=True, num_objects=1, show_vertices=True, styles={'fill_color': ['red']})
        self.draw_source = ColumnDataSource(data=dict(x=[], y=[]))

    def view(self):
        point_view = datashade((hv.Scatter(self.event_data, self.x_transform.x_param, self.y_transform.x_param))).opts(width=450, height=450)
        #point_view = datashade(hv.Scatter(self.event_data, self.x_transform.x_param, self.y_transform.x_param)).opts(width=450, height=450, tools=[DrawTool(source=self.draw_source)])
        return pn.panel(point_view, self.polygons)
        return pn.Pane((point_view * self.polygons).opts(hv.opts(width=450, height=450), hv.opts.Polygons(active_tools=['poly_edit'])))