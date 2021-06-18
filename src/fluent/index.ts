import {NodeEditor} from "./NodeEditor"
import {Node, Port} from "./NodeModels"

import {register_models} from "@bokehjs/base"
register_models({NodeEditor, Node, Port} as any)