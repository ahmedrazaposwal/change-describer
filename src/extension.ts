import * as vscode from "vscode";
import { exec } from "child_process";
import axios from 'axios';
import { resolve } from "path";

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand("arpdodo.describeChanges", async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("No workspace folder is open.");
			return;
		}
		
		const cwd = workspaceFolders[0].uri.fsPath;
		exec('git diff --cached', { cwd }, async(err, stdout) => {

			if (err || !stdout.trim()) {
				vscode.window.showInformationMessage('No staged changes found. Please run `git add .`');
				return;
			}

			const diff = stdout;
			
			const config = vscode.workspace.getConfiguration('arpdodo');
			const apiKey = config.get<string>('apiKey');

			if (!apiKey || apiKey.startsWith('api_REPLACE')) {
				vscode.window.showErrorMessage('Please Set your OpenAI API key!');
				return;
			}

			try {
				const summary = await askOpenAI(diff, apiKey);
				const doc = await vscode.workspace.openTextDocument({
					content: `Change Summary\n\n${summary}`,
					language: 'markdown'
				});
				vscode.window.showTextDocument(doc);
			} catch (e: any) {
				vscode.window.showErrorMessage(`Failed to generate summary: ${e.message}`);
			}
		});
	});
	context.subscriptions.push(disposable);
}

async function askOpenAI(diff:string, apiKey:string): Promise<string> {
	const response = await axios.post(
		'https://api.openai.com/v1/chat/completions',
		{
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'system',
					content: 'You are a senior developer who summarizes Git diff.'
				},
				{
					role: 'user',
					content: `Explain these Git changes: what was changed, why it was changed, and how:\n\n${diff}`
				}
			]
		},
		{
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		}
	);

	return response.data.choices[0].message.content.trim();
}
export function deactivate() {}