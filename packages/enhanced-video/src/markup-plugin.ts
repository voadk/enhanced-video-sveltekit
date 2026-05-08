import MagicString from 'magic-string';
import { parse } from 'svelte-parse-markup';
import type { AST } from 'svelte/compiler';
import type { Plugin } from 'vite';
import { walk } from 'zimmerframe';

const RUNTIME_IMPORT = 'enhanced-video-sveltekit/runtime';
const PASS_THROUGH_DROP = new Set(['src', 'poster']);
const TAG_NAME = 'enhanced:video';

type AnyAttribute = AST.RegularElement['attributes'][number];

export function markup_plugin(): Plugin {
	const name = 'enhanced-video:markup';

	const plugin: Plugin = {
		name,
		configResolved(config) {
			const svelte_plugin = config.plugins.find((p) => p.name === 'vite-plugin-svelte:config');
			if (!svelte_plugin) {
				throw new Error(
					'enhanced-video requires @sveltejs/vite-plugin-svelte 6 or higher to be installed before this plugin'
				);
			}
			const api = (svelte_plugin as { api?: { filter?: { id?: unknown }; idFilter?: { id?: unknown } } }).api;
			const id_filter = api?.filter?.id ?? api?.idFilter?.id;
			if (!id_filter) {
				throw new Error('enhanced-video could not read the Svelte plugin id filter');
			}
			const transform = plugin.transform as { filter: { id?: unknown } };
			transform.filter.id = id_filter;
		},
		transform: {
			order: 'pre',
			filter: {
				code: /<enhanced:video/
			},
			handler(content, filename) {
				const s = new MagicString(content);
				const ast = parse(content, { filename, modern: true });

				const imports = new Map<string, string>();
				let needs_runtime_import = false;

				walk(ast as unknown as AST.SvelteNode, null, {
					RegularElement(node, { next }) {
						if (node.name !== TAG_NAME) {
							next();
							return;
						}
						const src_attr = get_attr_value(node, 'src');
						if (!src_attr) {
							throw new Error(
								`enhanced-video: <${TAG_NAME}> requires a src attribute (in ${filename})`
							);
						}
						if (src_attr.type === 'ExpressionTag') {
							throw new Error(
								`enhanced-video: dynamic src={...} is not supported yet on <${TAG_NAME}>. Use a string literal (in ${filename}).`
							);
						}

						const original_url = src_attr.data.trim();
						const import_name =
							imports.get(original_url) ?? `__ENHANCED_VIDEO_${imports.size}__`;
						imports.set(original_url, import_name);
						needs_runtime_import = true;

						const passthrough = serialize_passthrough_attributes(content, node.attributes);
						const replacement = `<EnhancedVideo metadata={${import_name}}${passthrough ? ' ' + passthrough : ''} />`;
						s.update(node.start, node.end, replacement);
					}
				});

				if (!needs_runtime_import && imports.size === 0) {
					return null;
				}

				let import_text = '';
				if (needs_runtime_import) {
					import_text += `\timport EnhancedVideo from ${JSON.stringify(RUNTIME_IMPORT)};\n`;
				}
				for (const [orig, name] of imports) {
					import_text += `\timport ${name} from ${JSON.stringify(append_query(orig))};\n`;
				}

				if (ast.instance) {
					const body_start = (ast.instance.content as unknown as { start: number }).start;
					s.appendLeft(body_start, import_text);
				} else {
					s.prepend(`<script>\n${import_text}</script>\n`);
				}

				if (ast.css) {
					const css = content.substring(ast.css.start, ast.css.end);
					const modified = css.replaceAll('enhanced\\:video', 'video');
					if (modified !== css) {
						s.update(ast.css.start, ast.css.end, modified);
					}
				}

				return {
					code: s.toString(),
					map: s.generateMap({ hires: 'boundary' })
				};
			}
		}
	};
	return plugin;
}

function append_query(url: string): string {
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}enhanced-video`;
}

function get_attr_value(
	node: AST.RegularElement,
	attr: string
): AST.Text | AST.ExpressionTag | undefined {
	for (const a of node.attributes) {
		if (a.type !== 'Attribute' || a.name !== attr) continue;
		if (a.value === true) return undefined;
		if (Array.isArray(a.value)) {
			return a.value.length > 0 ? a.value[0] : undefined;
		}
		return a.value;
	}
	return undefined;
}

function serialize_passthrough_attributes(content: string, attributes: AnyAttribute[]): string {
	const parts: string[] = [];
	for (const attribute of attributes) {
		if (
			(attribute.type === 'Attribute' || attribute.type.endsWith('Directive')) &&
			'name' in attribute &&
			PASS_THROUGH_DROP.has(attribute.name)
		) {
			continue;
		}
		parts.push(content.substring(attribute.start, attribute.end));
	}
	return parts.join(' ');
}
