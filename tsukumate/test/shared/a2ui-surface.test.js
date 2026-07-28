"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseA2uiSurfaces } = require("../../src/shared/chat/a2ui-surface");

test("A2UI fences preserve ordinary text and retain only declared components", () => {
  const result = parseA2uiSurfaces(`说明文字\n\`\`\`a2ui
{"id":"lesson","components":[{"id":"code-1","type":"tsukumate.code","language":"js","code":"console.log(1)"},{"id":"evil","type":"unknown","script":"bad"}]}
\`\`\``);
  assert.equal(result.content, "说明文字");
  assert.equal(result.a2uiSurfaces.length, 1);
  assert.equal(result.a2uiSurfaces[0].components.length, 1);
  assert.equal(result.a2uiSurfaces[0].components[0].type, "code");
});

test("A2UI rejects incomplete JSON and strips untrusted media fields", () => {
  assert.equal(parseA2uiSurfaces("```a2ui\n{bad\n```").a2uiSurfaces.length, 0);
  const result = parseA2uiSurfaces("```a2ui\n{\"components\":[{\"type\":\"mediaVideo\",\"sourceId\":\"source-123\",\"url\":\"https://bad.example\"}]}\n```");
  assert.equal(result.a2uiSurfaces[0].components[0].sourceId, "source-123");
  assert.equal(Object.hasOwn(result.a2uiSurfaces[0].components[0], "url"), false);
});

test("A2UI accepts the JSON a2ui array shape emitted by compatible models", () => {
  const result = parseA2uiSurfaces(`普通说明\n\`\`\`json
{"a2ui":[{"type":"tsukumate.table","title":"公式","columns":["符号"],"rows":[["F"]]},{"type":"tsukumate.mindmap","root":{"text":"牛顿第二定律","children":[{"text":"F=ma"}]}},{"type":"tsukumate.code","title":"示例","language":"python","content":"force = 10"}]}
\`\`\``);
  assert.equal(result.content, "普通说明");
  const components = result.a2uiSurfaces[0].components;
  assert.deepEqual(components.map((item) => item.type), ["table", "mindmap", "code"]);
  assert.equal(components[1].nodes.length, 2);
  assert.equal(components[2].code, "force = 10");
});

test("deterministic code output is retained without executing the code", () => {
  const result = parseA2uiSurfaces("```a2ui\n{\"components\":[{\"type\":\"tsukumate.code\",\"code\":\"print(2 + 3)\",\"output\":\"5\"},{\"type\":\"tsukumate.code\",\"code\":\"print(input())\",\"output\":\"unknown\",\"outputDeterministic\":false}]}\n```");
  assert.equal(result.a2uiSurfaces[0].components[0].output, "5");
  assert.equal(Object.hasOwn(result.a2uiSurfaces[0].components[1], "output"), false);
});

test("simple deterministic Python cards get a static output without code execution", () => {
  const result = parseA2uiSurfaces("```a2ui\n{\"components\":[{\"type\":\"tsukumate.code\",\"language\":\"python\",\"content\":\"force = 10\\nmass = 2\\nacceleration = force / mass\\nprint(f'加速度为 {acceleration} m/s²')\"}]}\n```");
  const card = result.a2uiSurfaces[0].components[0];
  assert.equal(card.output, "加速度为 5 m/s²");
  assert.equal(card.outputInferred, true);
});

test("visual bubble surfaces keep a controlled theme and safe rich components", () => {
  const result = parseA2uiSurfaces("```a2ui\n{\"theme\":\"science\",\"components\":[{\"type\":\"tsukumate.formula\",\"tex\":\"F=ma\"},{\"type\":\"tsukumate.mermaid\",\"diagram\":\"flowchart TD; A-->B\"},{\"type\":\"tsukumate.svgFragment\",\"svg\":\"<svg><script>alert(1)</script><circle/></svg>\"}]}\n```");
  const surface = result.a2uiSurfaces[0];
  assert.equal(surface.theme, "science");
  assert.deepEqual(surface.components.map((item) => item.type), ["formula", "mermaid", "svgFragment"]);
  assert.match(surface.components[2].svg, /script/);
});

test("unknown visual themes fall back to the controlled default", () => {
  const result = parseA2uiSurfaces("```a2ui\n{\"theme\":\"neon-untrusted\",\"components\":[{\"type\":\"tsukumate.text\",\"text\":\"x\"}]}\n```");
  assert.equal(result.a2uiSurfaces[0].theme, "default");
});

test("visual runtime prompt advertises HTML fragments, Three.js and constrained reply actions", () => {
  const { a2uiSystemPrompt } = require("../../src/shared/chat/a2ui-surface");
  const prompt = a2uiSystemPrompt();
  assert.match(prompt, /WORKSPACE VISUAL RUNTIME CAPABILITIES/);
  assert.match(prompt, /Three\.js/);
  assert.match(prompt, /vcp-root/);
  assert.match(prompt, /\{\{VarDivRender\}\}/);
  assert.match(prompt, /onclick=\\?"input/);
});

test("learning organization requests require a raw visual root while plain-text requests opt out", () => {
  const { workspaceVisualOutputPrompt } = require("../../src/shared/chat/a2ui-surface");
  assert.match(workspaceVisualOutputPrompt("请整理这篇课文的重点单词和短语"), /VISUAL OUTPUT IS REQUIRED/);
  assert.match(workspaceVisualOutputPrompt("请纯文字整理单词"), /plain-text only/);
});

test("UniStudy visual variable contract resolves RenderingGuide before the model sees it", () => {
  const { uniStudyVisualSystemPrompt } = require("../../src/shared/chat/a2ui-surface");
  const prompt = uniStudyVisualSystemPrompt();
  assert.match(prompt, /Output formatting requirement:/);
  assert.match(prompt, /response-root/);
  assert.match(prompt, /视觉通感/);
  assert.doesNotMatch(prompt, /\{\{RenderingGuide\}\}/);
});
