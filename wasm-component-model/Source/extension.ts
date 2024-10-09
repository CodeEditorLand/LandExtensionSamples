/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Memory, WasmContext } from "@vscode/wasm-component-model";
import * as vscode from "vscode";

// Import the code generated by wit2ts
import { calculator, Types } from "./calculator";

export async function activate(
	context: vscode.ExtensionContext,
): Promise<void> {
	// The channel for printing the result.
	const channel = vscode.window.createOutputChannel("Calculator");
	context.subscriptions.push(channel);

	// The channel for printing the log.
	const log = vscode.window.createOutputChannel("Calculator - Log", {
		log: true,
	});
	context.subscriptions.push(log);

	// Load the Wasm module
	const filename = vscode.Uri.joinPath(
		context.extensionUri,
		"target",
		"wasm32-unknown-unknown",
		"debug",
		"calculator.wasm",
	);
	const bits = await vscode.workspace.fs.readFile(filename);
	const module = await WebAssembly.compile(bits);

	// The implementation of the log function that is called from WASM
	const service: calculator.Imports = {
		log: (msg: string) => {
			log.info(msg);
		},
	};

	// The context for the WASM module
	const wasmContext: WasmContext.Default = new WasmContext.Default();

	// Create the bindings to import the log function into the WASM module
	const imports = calculator._.imports.create(service, wasmContext);
	// Instantiate the module
	const instance = await WebAssembly.instantiate(module, imports);

	// Bind the WASM memory to the context
	wasmContext.initialize(new Memory.Default(instance.exports));

	// Bind the TypeScript Api
	const api = calculator._.exports.bind(
		instance.exports as calculator._.Exports,
		wasmContext,
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"vscode-samples.wasm-component-model.run",
			() => {
				channel.show();
				channel.appendLine("Running calculator example");
				const add = Types.Operation.Add({ left: 1, right: 2 });
				channel.appendLine(`Add ${api.calc(add)}`);
				const sub = Types.Operation.Sub({ left: 10, right: 8 });
				channel.appendLine(`Sub ${api.calc(sub)}`);
				const mul = Types.Operation.Mul({ left: 3, right: 7 });
				channel.appendLine(`Mul ${api.calc(mul)}`);
				const div = Types.Operation.Div({ left: 10, right: 2 });
				channel.appendLine(`Div ${api.calc(div)}`);
				try {
					channel.appendLine(
						`Divide by Zero ${api.calc(Types.Operation.Div({ left: 10, right: 0 }))}`,
					);
				} catch (error) {
					if (
						error instanceof Types.ErrorCode.Error_ &&
						error.cause === Types.ErrorCode.divideByZero
					) {
						channel.appendLine("Division by zero not allowed");
					}
				}
			},
		),
	);
}
