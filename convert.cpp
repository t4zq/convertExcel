#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <cstdlib>
#include <emscripten/emscripten.h>
using namespace std;
void trim(string &s) {
  auto start = s.find_first_not_of(" \t\r\n");
  auto end = s.find_last_not_of(" \t\r\n");
  s = (start == string::npos) ? "" : s.substr(start, end - start + 1);
}

vector<string> split(const string &line) {
  vector<string> out;
  string cur;
  char punctuation = line.find('\t') != string::npos ? '\t' : ',';
  for (char c : line) {
    if (c == punctuation) { out.push_back(cur); cur.clear(); }
    else cur += c;
  }
  out.push_back(cur);
  return out;
}

typedef vector<vector<string>> Table;

Table parse(const string &input) {
  Table t;
  stringstream ss(input);
  string line;
  while (getline(ss, line)) {
    trim(line);
    if (line.empty()) continue;
    auto cells = split(line);
    for (auto &c : cells) trim(c);
    t.push_back(cells);
  }
  return t;
}

string escape(const string &s) {
  string out;
  for (char c : s) {
    if (c == '&' || c == '%' || c == '$' || c == '#' || c == '_' || c == '{' || c == '}') out += '\\';
    out += c;
  }
  return out;
}

string to_latex(const Table &t) {
  if (t.empty()) return "";
  string out = "\\begin{tabular}{" + string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      out += escape(row[i]);
    }
    out += " \\\\\n";
  }
  return out + "\\hline\n\\end{tabular}";
}

string to_csv(const Table &t) {
  string out;
  for (size_t i = 0; i < t.size(); ++i) {
    for (size_t j = 0; j < t[i].size(); ++j) {
      if (j) out += ',';
      out += t[i][j];
    }
    if (i + 1 < t.size()) out += '\n';
  }
  return out;
}

char* dup(const string &s) {
  char *p = (char*)malloc(s.size() + 1);
  memcpy(p, s.c_str(), s.size() + 1);
  return p;
}

extern "C" {
EMSCRIPTEN_KEEPALIVE char* gen_latex(const char* in) {
  return in ? dup(to_latex(parse(in))) : dup("");
}
EMSCRIPTEN_KEEPALIVE char* gen_csv(const char* in) {
  return in ? dup(to_csv(parse(in))) : dup("");
}
}
