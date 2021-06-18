from bokeh.core.properties import Instance, List, Enum, String, Dict, Bool, Int, Color, Interval, Either
from bokeh.events import Event
from bokeh.models import HTMLBox, Model

# Following the example of
# https://github.com/bokeh/bokeh/blob/35c49c5865d574601bcd4627484905a4071366a0/bokeh/events.py#L209

class NodeEvent(Event):
    '''
    Base class for all NodeEditor events.

    This base class is not typically useful to instantiate on its own.
    '''


class Port(Model):
    port_name     = String(help='The *unique* name of the port')
    is_input      = Bool()
    datatype      = String(help="The type of port")
    control       = Enum("none", "boolean", "integer", "float", "string", "select")
    value         = Either(Bool, Int, String)

class Node(Model):
    node_name   = String(help='The name of the node')
    uid         = String(help='The *unique* name of this node')
    ports       = List(Instance(Port))

class NodeEditor(HTMLBox):
    nodes       = Dict(keys_type=String, values_type=Instance(Node), help="Node dictionary")
    port_colors = Dict(keys_type=String, values_type=Color, help="Mapping between port type and color")
    # Need a connections type
    