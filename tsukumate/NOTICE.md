# Notices

This project includes third-party materials.

## A2UI Web Core

The A2UI surface validation/runtime integration uses `@a2ui/web_core` from
the A2UI project. It is licensed under the Apache License, Version 2.0.
Copyright remains with the A2UI project contributors.

## UniStudy rich-content renderer

The safe HTML/CSS preview structure in `src/renderer/shared/rich-content/`
is adapted from the UniStudy project and has been modified to use a
scriptless, network-isolated iframe. UniStudy is distributed under the MIT
License. Copyright remains with the UniStudy contributors.

TsukuMate's visual-learning-bubble architecture also draws from UniStudy's
documented stable/tail streaming and scoped-content design. Its implementation
was rewritten for TsukuMate's A2UI component boundary; it does not reuse
UniStudy's bare-DOM injection or unrestricted event-handler paths.

## Three.js preview vendor

`src/renderer/shared/rich-content/three.min.js` is the Three.js vendor build
distributed with UniStudy for its interactive preview path. Copyright 2010–2023
Three.js Authors; licensed under the MIT License.

## OpenClaw Pixel Lobster Icon

`assets/icons/agents/openclaw.svg` is adapted from OpenClaw's
`docs/assets/pixel-lobster.svg`.

OpenClaw is licensed under the MIT License:

MIT License

Copyright (c) 2025 Peter Steinberger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
