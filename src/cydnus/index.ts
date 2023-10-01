import {PolygonGateTool} from "./PolygonGateTool"

import {register_models} from "@bokehjs/base"
console.log("cydnus: About to register custom Bokeh modules")
register_models({PolygonGateTool})
console.log("cydnus: Done registering")