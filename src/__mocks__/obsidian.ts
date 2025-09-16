// Mock implementation of Obsidian API for testing

export class App {
	vault = {
		getName: jest.fn(() => 'Test Vault'),
		getFiles: jest.fn(() => []),
		adapter: {
			read: jest.fn(),
			write: jest.fn(),
			getBasePath: jest.fn(() => '/test/vault'),
		},
	};
	workspace = {
		getActiveFile: jest.fn(),
		activeLeaf: null,
		getLeavesOfType: jest.fn(() => []),
	};
}

export class Plugin {
	app: App;
	manifest: any;

	constructor(app: App, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	addCommand(command: any) {}
	addRibbonIcon(icon: string, title: string, callback: () => void) {}
	addSettingTab(tab: any) {}
	registerView(type: string, viewCreator: any) {}
	loadData() {
		return Promise.resolve({});
	}
	saveData(data: any) {
		return Promise.resolve();
	}
}

export class Notice {
	constructor(message: string, duration?: number) {}
}

export class ItemView {
	leaf: any;
	app: App;
	
	constructor(leaf: any) {
		this.leaf = leaf;
		this.app = new App();
	}
	
	getViewType(): string {
		return 'test-view';
	}
	
	getDisplayText(): string {
		return 'Test View';
	}
	
	async onOpen() {}
	async onClose() {}
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	
	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}
	
	display(): void {}
	hide(): void {}
}

export function addIcon(name: string, svg: string) {}

// Export other commonly used types
export interface TFile {
	path: string;
	name: string;
	extension: string;
}

export interface Editor {
	getValue(): string;
	setValue(value: string): void;
	getSelection(): string;
	replaceSelection(replacement: string): void;
	getCursor(pos?: 'from' | 'to'): { line: number; ch: number };
}