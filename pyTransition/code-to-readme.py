#!/usr/bin/env python3

# MIT License

# Copyright (c) 2024 Polytechnique Montréal

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""

Code to README Integration Tool
==============================
(This was done with claude.ai)


This script helps maintain code examples in README files by automatically extracting
and inserting code snippets from source files. It uses markers in both the README
and source files to determine where code should be inserted.

Usage
-----
```bash
python code_to_readme.py --readme README.md --config examples.yaml
```

Configuration File (examples.yaml)
--------------------------------
The configuration file should be in YAML format and specify which code blocks
should be inserted where. Example structure:

```yaml
examples:
  - block_id: basic_example     # Unique identifier for this code block
    path: src/example.py        # Path to the source file
    markers:                    # Optional: if not provided, includes entire file
      - start: "# START basic"  # Start marker in source file
        end: "# END basic"      # End marker in source file
        include_markers: false  # Whether to include markers in output
    language: python            # Optional: override language detection

  - block_id: full_file        # Example without markers
    path: src/util.py          # Will include the entire file
```

README Format
------------
In your README.md, place markers where you want code to be inserted:

```markdown
<!-- BEGIN basic_example -->
```python
# Code will be automatically inserted here
```
<!-- END basic_example -->
```

Source File Format
-----------------
In your source files, mark the code sections you want to extract (if using markers):

```python
# Other code...

# START basic
def example():
    print("This will be extracted")
# END basic

# More code...
```

Features
--------
- Extract whole files or specific marked sections
- Optional inclusion of marker comments
- Language auto-detection based on file extension
- Multiple code blocks per file
- Preserve README formatting outside of marked sections
"""

import re
from pathlib import Path
import argparse
import yaml
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple

@dataclass
class MarkerPair:
    start: str
    end: str
    include_markers: bool = False

@dataclass
class CodeExample:
    path: str
    block_id: str
    markers: Optional[List[MarkerPair]] = None
    language: Optional[str] = None

class CodeToReadmeIntegrator:
    def __init__(self, readme_path: str):
        self.readme_path = Path(readme_path)
        
    @staticmethod
    def load_config(config_path: str) -> Dict[str, CodeExample]:
        """Load example files configuration from YAML file."""
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            
        examples = {}
        for item in config['examples']:
            # Convert markers configuration to MarkerPair objects
            markers = None
            if 'markers' in item:
                markers = [
                    MarkerPair(
                        start=m['start'],
                        end=m['end'],
                        include_markers=m.get('include_markers', False)
                    ) for m in item['markers']
                ]
            
            examples[item['block_id']] = CodeExample(
                path=item['path'],
                block_id=item['block_id'],
                markers=markers,
                language=item.get('language')
            )
        return examples

    def detect_language(self, file_path: str, override: Optional[str] = None) -> str:
        """Detect language based on file extension or override."""
        if override:
            return override
            
        extension_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.sh': 'bash',
            '.java': 'java',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
        }
        return extension_map.get(Path(file_path).suffix, 'text')

    def extract_code(self, content: str, markers: Optional[List[MarkerPair]]) -> str:
        """Extract code between markers or return full content."""
        if not markers:
            return content.strip()
            
        extracted = []
        lines = content.split('\n')
        capturing = False
        current_snippet = []
        current_marker = None
        
        for line in lines:
            # Check for start markers
            for marker in markers:
                if marker.start in line:
                    capturing = True
                    current_marker = marker
                    if marker.include_markers:
                        current_snippet.append(line)
                    break
                elif marker.end in line:
                    if marker == current_marker:
                        if marker.include_markers:
                            current_snippet.append(line)
                        capturing = False
                        current_marker = None
                        if current_snippet:
                            extracted.append('\n'.join(current_snippet))
                            current_snippet = []
                    break
            else:  # no marker found in this line
                if capturing:
                    current_snippet.append(line)
        
        return '\n\n'.join(extracted).strip()

    def update_readme(self, examples: Dict[str, CodeExample]) -> None:
        """Update README file with code examples."""
        with open(self.readme_path, 'r') as f:
            content = f.read()

        for block_id, example in examples.items():
            # Pattern to match content between markers including the markers
            pattern = f"(<!-- BEGIN {block_id} -->).*(<!-- END {block_id} -->)"
            
            try:
                # Read the source file
                with open(example.path, 'r') as f:
                    code = f.read()
                
                # Extract relevant code if markers are specified
                code = self.extract_code(code, example.markers)
                
                # Detect language
                language = self.detect_language(example.path, example.language)
                
                # Create the replacement block
                replacement = f"""<!-- BEGIN {block_id} -->
```{language}
{code}
```
<!-- END {block_id} -->"""

                # Replace in README
                content = re.sub(pattern, replacement, content, flags=re.DOTALL)
                
            except FileNotFoundError:
                print(f"Warning: Source file not found: {example.path}")
            except Exception as e:
                print(f"Error processing block {block_id}: {str(e)}")

        # Write updated content
        with open(self.readme_path, 'w') as f:
            f.write(content)

def main():
    parser = argparse.ArgumentParser(description='Integrate code files into README')
    parser.add_argument('--readme', required=True, help='Path to README.md')
    parser.add_argument('--config', required=True, help='Path to examples configuration YAML')
    
    args = parser.parse_args()
    
    integrator = CodeToReadmeIntegrator(args.readme)
    examples = integrator.load_config(args.config)
    integrator.update_readme(examples)

if __name__ == "__main__":
    main()
