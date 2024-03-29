import * as bprop from "@bokehjs/core/properties"
//import * as btypes from "@bokehjs/core/types"
import { Model } from "@bokehjs/model"

export namespace Port {
    export type Attrs = bprop.AttrsOf<Props>
    export type Props = {
        port_name: bprop.Property<string>,
        is_input: bprop.Property<boolean>,
        incoming_node: bprop.Property<string>,
        incoming_port: bprop.Property<string>,
        datatype: bprop.Property<string>,
        control: bprop.Property<"none" | "boolean" | "integer" | "float" | "string" | "select">,
        value: bprop.Property<boolean | number | string>
    }
}

export interface Port extends Port.Attrs {}

export class Port extends Model {
    static __name__ = "Port"
    static __module__ = "fluent.NodeEditor"

    static init_Port(): void {
        this.define<Port.Props>(({Boolean, String, Int, Enum, Or}) => ({
            port_name: [ String, "" ],
            is_input: [ Boolean, false ],
            incoming_node: [ String, "" ],
            incoming_port: [ String, "" ],
            datatype: [ String, "" ],
            control: [ Enum("none", "boolean", "integer", "float", "string", "select"), "none"],
            value: [ Or(Boolean, Int, String), false ]
        }))
    }
}


export type Location = {
    x: number,
    y: number
}

export namespace Node {
    export type Attrs = bprop.AttrsOf<Props>
    export type Props = {
        node_name: bprop.Property<string>,
        uid: bprop.Property<string>,
        ports: bprop.Property<Port[]>,
        location: bprop.Property<Location>
    }
}

export interface Node extends Node.Attrs {}

export class Node extends Model {
    static __name__ = "Node"
    static __module__ = "fluent.NodeEditor"

    static init_Node(): void {
        this.define<Node.Props>(({String, Ref, Array}) => ({
            node_name: [ String, "" ],
            uid: [ String, "" ],
            ports: [ Array(Ref(Port)), [] ]
        }))

        this.internal<Node.Props>(({Number, Struct}) => {
            const Location = Struct({
                x: Number,
                y: Number
            })

            return {
                location: [ Location, {x: 0, y: 0} ],
                width: [ Number, 100 ]
            }
        })
    }
}