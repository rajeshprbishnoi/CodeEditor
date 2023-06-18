const express = require("express");
const cors = require("cors");
const Axios = require("axios");

const { exec } = require("child_process");
const { spawn } = require("child_process");

const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Specify the paths to the locally installed GCC and JDK
const gccPath = "/usr/bin/gcc";
const javaPath = "/usr/bin/javac";

// Helper function to process user input during code execution
function processInput(childProcess, input, callback) {
	childProcess.stdin.write(input + "\n");
	childProcess.stdin.end();

	let output = "";
	childProcess.stdout.on("data", (data) => {
		output += data.toString();
	});

	let errors = "";
	childProcess.stderr.on("data", (data) => {
		errors += data.toString();
	});

	childProcess.on("exit", (code) => {
		callback(null, output, errors);
	});
}

// Function to run code in a specific language
function runCode(code, language, input, callback) {
	// Create a temporary file with a unique name
	const tempFileName = `temp_${Date.now()}.${getFileExtension(language)}`;
	const tempFilePath = path.join(__dirname, tempFileName);

	// Write the code to the temporary file
	fs.writeFile(tempFilePath, code, (err) => {
		if (err) {
			return callback(err);
		}

		// Execute the code based on the language
		let command;
		let args;

		switch (language) {
			case "c":
				command = gccPath;
				args = [tempFilePath, "-o", tempFilePath + ".out"];
				break;
			case "cpp":
				command = gccPath;
				args = [tempFilePath, "-o", tempFilePath + ".out"];
				break;
			case "java":
				command = javaPath;
				args = ["-cp", path.dirname(tempFilePath), getClassName(code)];
				break;
			case "python":
				command = "python3";
				args = [tempFilePath];
				break;
			// Add cases for other languages as needed

			default:
				return callback(new Error("Unsupported language"));
		}

		// Execute the compilation command in a child process
		const compilationProcess = spawn(command, args);

		compilationProcess.on("exit", (code) => {
			if (code === 0) {
				// Compilation successful, execute the code

				let executionCommand;
				let executionArgs;

				switch (language) {
					case "c":
					case "cpp":
						executionCommand = path.join(
							__dirname,
							`${tempFileName}.out`
						);
						executionArgs = [];
						break;
					case "java":
						executionCommand = "java";
						executionArgs = [
							"-cp",
							path.dirname(tempFilePath),
							getClassName(code),
						];
						break;
					case "python":
						executionCommand = "python3";
						executionArgs = [tempFilePath];
						break;
					// Add cases for other languages as needed

					default:
						return callback(new Error("Unsupported language"));
				}

				const executionProcess = spawn(executionCommand, executionArgs);

				// Handle user input if provided
				if (input) {
					processInput(executionProcess, input, callback);
				} else {
					let output = "";
					let errors = "";

					executionProcess.stdout.on("data", (data) => {
						output += data.toString();
					});

					executionProcess.stderr.on("data", (data) => {
						errors += data.toString();
					});

					executionProcess.on("exit", (code) => {
						callback(null, output, errors);
					});
				}
			} else {
				// Compilation failed, return the error
				callback(new Error("Compilation failed"));
			}
		});
	});
}

// Helper function to extract the class name from Java code
function getClassName(code) {
	const classNameMatch = code.match(/class\s+(\w+)/);
	if (!classNameMatch) {
		throw new Error("Unable to extract class name from code");
	}
	return classNameMatch[1];
}

/*

// Function to run code in a specific language
function runCode(code, language, input, callback) {
	// Create a temporary file with a unique name
	const tempFileName = `temp_${Date.now()}.${getFileExtension(language)}`;
	const tempFilePath = path.join(__dirname, tempFileName);

	// Write the code to the temporary file
	fs.writeFile(tempFilePath, code, (err) => {
		if (err) {
			return callback(err);
		}

		// Execute the code based on the language
		let command;
		let args;

		switch (language) {
			case "c":
			case "cpp":
				command = "gcc";
				args = [tempFilePath, "-o", tempFilePath + ".exe"];
				break;
			case "java":
				command = "javac";
				args = [tempFilePath];
				break;
			case "python":
				command = "python3";
				args = [tempFilePath];
				break;
			// Add cases for other languages as needed

			default:
				return callback(new Error("Unsupported language"));
		}

		// Execute the command in a child process
		const childProcess = exec(
			command + " " + args.join(" "),
			(error, stdout, stderr) => {
				if (error) {
					return callback(error);
				}

				// Execute the compiled/interpreted code
				switch (language) {
					case "c":
					case "cpp":
						exec(
							tempFilePath + ".exe",
							{
								input: input, // Pass the input to the child process
							},
							(runError, runStdout, runStderr) => {
								callback(runError, runStdout, runStderr);
							}
						);
						break;
					case "java":
						const classNameMatch = code.match(/class\s+(\w+)/);
						if (!classNameMatch) {
							return callback(
								new Error(
									"Unable to extract class name from code"
								)
							);
						}
						const className = classNameMatch[1];
						const classFilePath = path.join(
							path.dirname(tempFilePath),
							`${className}.class`
						);
						exec(
							`java -cp ${path.dirname(
								classFilePath
							)} ${className}`,
							{
								input: input, // Pass the input to the child process
							},
							(runError, runStdout, runStderr) => {
								callback(runError, runStdout, runStderr);
							}
						);
						break;
					case "python":
						exec(
							`python3 ${tempFilePath}`,
							{
								input: input, // Pass the input to the child process
							},
							(runError, runStdout, runStderr) => {
								callback(runError, runStdout, runStderr);
							}
						);
						break;

					default:
						callback(null, stdout, stderr);
				}
			}
		);
	});
}
*/

// Helper function to get the file extension based on the language
function getFileExtension(language) {
	switch (language) {
		case "c":
			return "c";
		case "cpp":
			return "cpp";
		case "java":
			return "java";
		case "python":
			return "py";
		// Add cases for other languages as needed

		default:
			return "";
	}
}

app.post("/compile", (req, res) => {
	//getting the required data from the request
	let code = req.body.code;
	let language = req.body.language;
	let input = req.body.input;

	runCode(code, language, input, (error, output, errors) => {
		if (error) {
			console.error("Error:", error.message);
		} else {
			// Send the output and errors as a response to the frontend
			const responseData = {
				output: output,
				errors: errors,
			};
			res.send(responseData);
			console.log("Output:", output);
			console.error("Errors:", errors);
		}
	});

	/* TODO :

		1. take input from user 
		2. Delete temp files

	*/
});

app.listen(process.env.PORT || PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
