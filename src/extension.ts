// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");

let globalState: vscode.Memento;
let id: string | undefined;

let counter: number | undefined;

let currentColorTheme: string | undefined;

let lineNumbers: number[] = [];
let lineDecorations: vscode.DecorationOptions[];

let activeLine: string | undefined;

const lightDecoration: vscode.TextEditorDecorationType =
  vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(
      path.join(__dirname, "../images/light.png")
    ),
    gutterIconSize: "contain",
  });

const darkDecoration: vscode.TextEditorDecorationType =
  vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, "../images/dark.png")),
    gutterIconSize: "contain",
  });

let hasImport: boolean = false;

const uri = "link to db";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "gratitude" is now active!');
  console.log("Hello World!");

  globalState = context.globalState;

  if (globalState.get("id")) {
    // id already exists in local storage
    id = globalState.get("id");
    console.log("ID exists: " + id);
  } else {
    setUserId();
    console.log("New ID: " + id);
  }

  if (globalState.get("counter")) {
    // id already exists in local storage
    counter = globalState.get("counter");
  } else {
    counter = Math.floor(Math.random() * 5);
  }

  // Start - inactivity notification
  let inactivityTimeout: NodeJS.Timeout | undefined;

  const startInactivityTimer = () => {
    inactivityTimeout = setTimeout(() => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const text = document.getText();
        if (text.includes("import") || text.includes("require")) {
          showAutoDismissMessage(
            "Send a note of thanks to other developers!",
            10000
          );
        }
      }
    }, 1.8e6); // Set the desired inactivity duration in milliseconds (e.g., 30000 for 30 seconds)
  };

  const resetInactivityTimer = () => {
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
    }
    startInactivityTimer();
  };

  const checkForKeyword = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;
      const text = document.getText();
      if (text.includes("import") || text.includes("require")) {
        resetInactivityTimer();
      } else {
        stopInactivityTimer(); // Stop the inactivity timer if keyword is not found
      }
    }
  };

  const stopInactivityTimer = () => {
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = undefined;
    }
  };

  // Register event listeners to track user activity
  vscode.window.onDidChangeTextEditorSelection(resetInactivityTimer);
  vscode.workspace.onDidChangeTextDocument(resetInactivityTimer);
  vscode.window.onDidChangeActiveTextEditor(checkForKeyword);

  // Start the inactivity timer initially
  checkForKeyword();
  // End

  detectColorTheme();
  // Listen for changes in the color theme
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("workbench.colorTheme")) {
      // Color theme has changed
      detectColorTheme();
      if (currentColorTheme === "light") {
        vscode.window.activeTextEditor?.setDecorations(darkDecoration, []);
        vscode.window.activeTextEditor?.setDecorations(
          lightDecoration,
          lineDecorations
        );
      } else {
        vscode.window.activeTextEditor?.setDecorations(lightDecoration, []);
        vscode.window.activeTextEditor?.setDecorations(
          darkDecoration,
          lineDecorations
        );
      }
    }
  });

  // Start - gutter icon
  let activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const { document } = activeEditor;

    let lineNumbers = extractNames(document);

    // Add decorations to matching lines
    lineDecorations = lineNumbers.map((lineNumber) => ({
      range: new vscode.Range(lineNumber, 0, lineNumber, 0),
    }));
    if (currentColorTheme === "light") {
      activeEditor.setDecorations(lightDecoration, lineDecorations);
    } else {
      activeEditor.setDecorations(darkDecoration, lineDecorations);
    }
  }

  vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      const { document } = activeEditor;

      activeEditor.setDecorations(lightDecoration, []);
      activeEditor.setDecorations(darkDecoration, []);

      let lineNumbers: number[] = extractNames(document);

      // Add decorations to matching lines
      lineDecorations = lineNumbers.map((lineNumber) => ({
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
      }));
      if (currentColorTheme === "light") {
        activeEditor.setDecorations(lightDecoration, lineDecorations);
      } else {
        activeEditor.setDecorations(darkDecoration, lineDecorations);
      }
    }
  });
  // End

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    activeEditor = editor;

    if (editor) {
      const { document } = editor;

      editor.setDecorations(lightDecoration, []);
      editor.setDecorations(darkDecoration, []);

      let lineNumbers: number[] = extractNames(document);

      // Add decorations to matching lines
      lineDecorations = lineNumbers.map((lineNumber) => ({
        range: new vscode.Range(lineNumber, 0, lineNumber, 0),
      }));
      if (currentColorTheme === "light") {
        editor.setDecorations(lightDecoration, lineDecorations);
      } else {
        editor.setDecorations(darkDecoration, lineDecorations);
      }
    }
  });

  vscode.languages.registerHoverProvider(
    { scheme: "file" },
    {
      // , language: 'python'
      provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
      ): vscode.ProviderResult<vscode.Hover> {
        const line = document.lineAt(position.line);
        const lineNumber = line.lineNumber;

        if (lineNumbers.includes(lineNumber)) {
          const hoverMessage =
            "Right-click on the raised hands icon to say thanks";

          // Define the range for the hover message
          const range = new vscode.Range(lineNumber, 0, lineNumber, 1);

          return new vscode.Hover(hoverMessage, range);
        }

        return null; // Return null if no hover message should be displayed for the current line
      },
    }
  );

  if (activeEditor) {
    vscode.commands.executeCommand(
      "setContext",
      "gratitude.hasImport",
      hasImport
    );
  }
  vscode.workspace.onDidChangeTextDocument((event) => {
    vscode.commands.executeCommand(
      "setContext",
      "gratitude.hasImport",
      hasImport
    );
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("gratitude.sayThanks", async (args) => {
      const lineNumber: number = args.lineNumber;
      if (activeEditor) {
        console.log("Counter: " + counter);
        activeLine = activeEditor.document.lineAt(args.lineNumber - 1).text;
        const defaultThanks = "default";
        const data = {
          lineNumber,
          activeLine,
          timestamp: new Date(),
          userId: id,
        };
        await saveResponseToMongoDB(data);
        const additionalMessage =
          "Your thanks has been sent! If you feel inspired to share more, don't hesitate to send a note to the contributors. Your words of encouragement can make a world of difference and let them know just how much their efforts are valued.";
        const sayMore = "Say More";
        const surveyMessage = "Please complete this quick survey!";
        const fillOutSurvey = "Fill Out Survey";
        vscode.window
          .showInformationMessage(
            additionalMessage,
            { modal: true },
            { title: sayMore }
          )
          .then((selectedAction) => {
            if (selectedAction && selectedAction.title === sayMore) {
              vscode.commands.executeCommand(`gratitude.sayMore`);
            }
            if (counter === 0) {
              counter = Math.floor(Math.random() * 4) + 1;
              globalState.update("counter", counter);
              return vscode.window.showInformationMessage(
                surveyMessage,
                { modal: true },
                { title: fillOutSurvey }
              );
            } else if (counter) {
              counter -= 1;
              globalState.update("counter", counter);
            }
          })
          .then((selectedAction) => {
            if (selectedAction && selectedAction.title === fillOutSurvey) {
              vscode.commands.executeCommand(`gratitude.fillOutSurvey`);
            }
          });
      }
    })
  );

  // Register the command to handle the link click
  vscode.commands.registerCommand("gratitude.sayMore", () => {
    const loc = encodeURIComponent(JSON.stringify({ QID4: activeLine }));
    if (activeLine) {
      vscode.env.openExternal(
        vscode.Uri.parse(
          `https://cmu.ca1.qualtrics.com/jfe/form/SV_3Oj5m8n4yE0oHRk?userid=${id}&Q_PopulateResponse=${loc}`
        )
      );
    }
  });

  // Register the command to handle the survey link click
  vscode.commands.registerCommand("gratitude.fillOutSurvey", () => {
    const loc = encodeURIComponent(JSON.stringify({ QID11: activeLine }));
    if (activeLine) {
      vscode.env.openExternal(
        vscode.Uri.parse(
          `https://cmu.ca1.qualtrics.com/jfe/form/SV_eEUHt3Lb3sOifMG?userid=${id}&Q_PopulateResponse=${loc}`
        )
      );
    }
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  lightDecoration.dispose();
  darkDecoration.dispose();
}

function extractNames(document: vscode.TextDocument) {
  lineNumbers = [];
  let match: RegExpExecArray | null;
  let namesSet: Set<string> = new Set();

  if (document.languageId === "python") {
    const pyImportRegex =
      /^(\s*(?:from\s+[\w\.]+)?\s*import\s+[\w\*\, ]+(?:\s+as\s+[\w]+)?)\b/gm;
    while ((match = pyImportRegex.exec(document.getText()))) {
      lineNumbers.push(document.positionAt(match.index).line);

      const importStatement = match[1].trim();
      const statements = importStatement
        .split(/^(?:import|from)\s+/)[1]
        .split(/\s*,\s*/)
        .map((item) => item.trim());
      statements.forEach((item) => {
        const namesSplitByAs = item.split(/\s+as\s+/);
        if (namesSplitByAs.length === 1) {
          const name = namesSplitByAs[0];
          if (name.includes("import")) {
            namesSet.add(name.split(/\s+import\s+/)[1]);
          } else {
            namesSet.add(name);
          }
        } else {
          namesSet.add(namesSplitByAs[1]);
        }
      });
    }
  } else if (
    document.languageId === "javascript" ||
    document.languageId == "typescript"
  ) {
    const jsImportRegex = /^import\s+.*\s+from\s+['"](.*)['"]/gm;
    while ((match = jsImportRegex.exec(document.getText()))) {
      const fromSplit = match[0].split(/\s+from\s+/);
      if (
        fromSplit[1].trim().startsWith('"./') ||
        fromSplit[1].trim().startsWith('"/') ||
        fromSplit[1].trim().startsWith("'./") ||
        fromSplit[1].trim().startsWith("'/")
      ) {
        continue;
      }
      lineNumbers.push(document.positionAt(match.index).line);
      const statements = fromSplit[0]
        .split(/\s*import\s+/)[1]
        .split(/\s*,\s*/)
        .map((item) => item.trim());
      statements.forEach((item) => {
        if (/\s+as\s+/.test(item) || item.includes("{") || item.includes("}")) {
          const asSplit = item.split(/\s+as\s+/);
          const name = asSplit.length > 1 ? asSplit[1] : item;
          const bracketSplit = name.split(/\s*\{\s*/);
          const bracketName =
            bracketSplit.length > 1 ? bracketSplit[1] : bracketSplit[0];
          namesSet.add(bracketName.split(/\s*\}\s*/)[0]);
        } else {
          namesSet.add(item);
        }
      });
    }

    const jsRequireRegex =
      /(const|let)\s+\{?\s*([\w,\s]+)\s*\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)[^;]*;/g;
    while ((match = jsRequireRegex.exec(document.getText()))) {
      if (match[3].trim().startsWith("./") || match[3].trim().startsWith("/")) {
        continue;
      }
      lineNumbers.push(document.positionAt(match.index).line);
      if (match[2].includes(",")) {
        const splitNames = match[2].replace(/\s/g, "").split(",");
        splitNames.forEach((name) => namesSet.add(name));
      } else {
        namesSet.add(match[2].trim());
      }
    }
  }

  let names: string[] = Array.from(namesSet);

  if (names.length > 0) {
    const funcPattern = new RegExp(
      `\\b(?:${names
        .map((name) => `(?:(?:${name})\\.\\w+|${name})`)
        .join("|")})\\(`
    );

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      const isMatching = funcPattern.test(line);
      if (isMatching) {
        lineNumbers.push(lineNumber);
      } else {
        const attrPattern = new RegExp(
          `\\b(?:${names.map((name) => `(?:(?:${name})\\.\\w+)`).join("|")})`
        );
        if (attrPattern.test(line)) {
          lineNumbers.push(lineNumber);
        }
      }
    }
  }

  if (lineNumbers.length === 0) {
    hasImport = false;
  } else {
    hasImport = true;
  }

  return lineNumbers;
}

function detectColorTheme() {
  currentColorTheme = vscode.workspace
    .getConfiguration("workbench")
    .get("colorTheme");

  if (currentColorTheme?.includes("Light")) {
    currentColorTheme = "light";
  } else {
    currentColorTheme = "dark";
  }
}

async function createUserMongoDB() {
  let insertedId: string | undefined;

  try {
    await client.connect();

    const database = client.db("gratitude");
    const collection = database.collection("users");

    const result = await collection.insertOne({ timestamp: new Date() });

    if (result.insertedId) {
      console.log("User saved to MongoDB: " + result.insertedId);
      insertedId = result.insertedId.toString();
    }
  } catch (error) {
    console.error("Error saving user to MongoDB: ", error);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }

  return insertedId;
}

async function setUserId() {
  try {
    id = await createUserMongoDB();
    globalState.update("id", id);
  } catch (error) {
    console.error("Error saving user to MongoDB:", error);
  }
}

async function saveResponseToMongoDB(response: any) {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    const database = client.db("gratitude");
    const collection = database.collection("responses");

    await collection.insertOne(response);
    console.log("Response saved to MongoDB: " + response);
  } catch (error) {
    console.error("Error saving response to MongoDB: ", error);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

function showAutoDismissMessage(message: string, duration: number) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: message,
      cancellable: false,
    },
    async (progress, token) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(undefined);
        }, duration);
      });
    }
  );
}

class ImportStatementDetector {
  private lastImportCount: number = 0;

  public detectImportStatements(
    document: vscode.TextDocument,
    contentChanges?: readonly vscode.TextDocumentContentChangeEvent[]
  ) {
    if (!contentChanges) {
      // Manual detection
      this.checkImportStatements(document);
      return;
    }

    // Detect import statements triggered by content changes
    for (const change of contentChanges) {
      if (change.text.includes("\n")) {
        // Newline was inserted, check import statements
        this.checkImportStatements(document);
        break;
      }
    }
  }

  private checkImportStatements(document: vscode.TextDocument) {
    const importStatements = this.parseImportStatements(document);

    // Compare the number of import statements with the previous count
    if (importStatements.length > this.lastImportCount) {
      // Display a modal dialog indicating a new import statement
      vscode.window.showInformationMessage(
        "A new import statement was detected!"
      );
    }

    // Update the last import count
    this.lastImportCount = importStatements.length;
  }

  private parseImportStatements(document: vscode.TextDocument): string[] {
    const importStatements: string[] = [];
    console.log("parsing import statements");
    console.log(document.getText());

    if (document.languageId === "typescript") {
      const importRegex = /^import\s+.*\s+from\s+['"](.*)['"]/gm;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(document.getText()))) {
        const importStatement = match[1];
        importStatements.push(importStatement);
      }
    } else if (document.languageId === "python") {
      const importRegex =
        /^(\s*(?:from\s+[\w\.]+)?\s*import\s+[\w\*\, ]+(?:\s+as\s+[\w]+)?)\b/gm;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(document.getText()))) {
        const importStatement = match[1];
        console.log(match);
        importStatements.push(importStatement);
        console.log(importStatements);
      }
    }

    return importStatements;
  }
}
