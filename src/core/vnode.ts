export interface VNode {
  tag: string;
  attrs: Record<string, string | number>;
  children?: Array<VNode | string>;
}

export function h(tag: string, attrs: VNode["attrs"] = {}, children?: Array<VNode | string>): VNode {
  return children === undefined ? { tag, attrs } : { tag, attrs, children };
}
