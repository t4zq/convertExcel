#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <emscripten/emscripten.h>

void trim(std::string &s) {
  auto start = s.find_first_not_of(" \t\r\n");
  auto end = s.find_last_not_of(" \t\r\n");
  s = (start == std::string::npos) ? "" : s.substr(start, end - start + 1);
}

bool is_number(const std::string &s) {
  if (s.empty()) return false;
  size_t start = (s[0] == '-' || s[0] == '+') ? 1 : 0;
  if (start >= s.size()) return false;
  bool has_dot = false;
  for (size_t i = start; i < s.size(); ++i) {
    if (s[i] == '.') {
      if (has_dot) return false;
      has_dot = true;
    } else if (!isdigit(s[i])) {
      return false;
    }
  }
  return true;
}

std::string round_number(const std::string &s, int decimals) {
  if (!is_number(s)) return s;
  if (decimals < 0) decimals = 0;
  
  double value = std::stod(s);
  double multiplier = std::pow(10.0, decimals);
  double rounded = std::round(value * multiplier) / multiplier;
  
  std::ostringstream oss;
  oss.precision(decimals);
  oss << std::fixed << rounded;
  return oss.str();
}

std::string round_significant_figures(const std::string &s, int sig_figs) {
  if (!is_number(s)) return s;
  if (sig_figs <= 0) sig_figs = 1;
  
  double value = std::stod(s);
  if (value == 0.0) return "0";
  
  double abs_value = std::abs(value);
  int exponent = std::floor(std::log10(abs_value));
  double multiplier = std::pow(10.0, sig_figs - 1 - exponent);
  double rounded = std::round(value * multiplier) / multiplier;
  
  // 整数として表示する必要があるか判定
  int decimal_places = std::max(0, sig_figs - 1 - exponent);
  
  std::ostringstream oss;
  if (decimal_places > 0) {
    oss.precision(decimal_places);
    oss << std::fixed << rounded;
  } else {
    oss << std::fixed << rounded;
    std::string result = oss.str();
    // 小数点以下の0を削除
    size_t dot_pos = result.find('.');
    if (dot_pos != std::string::npos) {
      result = result.substr(0, dot_pos);
    }
    return result;
  }
  return oss.str();
}

std::vector<std::string> split(const std::string &line) {
  std::vector<std::string> out;
  std::string cur;
  char delim = line.find('\t') != std::string::npos ? '\t' : ',';
  for (char c : line) {
    if (c == delim) { out.push_back(cur); cur.clear(); }
    else cur += c;
  }
  out.push_back(cur);
  return out;
}

typedef std::vector<std::vector<std::string>> Table;

// 回帰モデルの種類
enum RegressionType {
  REG_LINEAR,      // y = ax + b
  REG_EXPONENTIAL, // y = a * exp(bx)
  REG_LOGARITHMIC, // y = a * ln(x) + b
  REG_POWER,       // y = a * x^b
  REG_AUTO         // 自動判定
};

// 回帰結果を格納する構造体
struct RegressionResult {
  RegressionType type;  // 回帰の種類
  double a;             // 係数a
  double b;             // 係数b
  double r_squared;     // 決定係数 (R²)
  bool valid;           // 計算が有効かどうか
  std::string equation; // 数式文字列
  std::string type_name; // 種類の名前
};

// 最小二乗法の結果を格納する構造体（後方互換性のため残す）
struct LinearRegression {
  double slope;       // 傾き (a)
  double intercept;   // 切片 (b)
  double r_squared;   // 決定係数 (R²)
  bool valid;         // 計算が有効かどうか
};

// 基本的な線形回帰（内部用）
// データ変換後の ln(y) vs x 等にも使用
struct SimpleLinearFit {
  double slope;
  double intercept;
  double r_squared;
  bool valid;
};

SimpleLinearFit simple_linear_fit(const std::vector<double> &x, const std::vector<double> &y) {
  SimpleLinearFit result = {0, 0, 0, false};
  
  size_t n = x.size();
  if (n < 2 || n != y.size()) return result;
  
  double sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0;
  for (size_t i = 0; i < n; ++i) {
    sum_x += x[i];
    sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_x2 += x[i] * x[i];
  }
  
  double denominator = n * sum_x2 - sum_x * sum_x;
  if (std::abs(denominator) < 1e-10) return result;
  
  result.slope = (n * sum_xy - sum_x * sum_y) / denominator;
  result.intercept = (sum_y * sum_x2 - sum_x * sum_xy) / denominator;
  
  double y_mean = sum_y / n;
  double ss_tot = 0, ss_res = 0;
  for (size_t i = 0; i < n; ++i) {
    double y_pred = result.slope * x[i] + result.intercept;
    ss_res += (y[i] - y_pred) * (y[i] - y_pred);
    ss_tot += (y[i] - y_mean) * (y[i] - y_mean);
  }
  
  result.r_squared = (ss_tot > 1e-10) ? (1.0 - ss_res / ss_tot) : 0;
  result.valid = true;
  
  return result;
}

// 線形回帰: y = ax + b
RegressionResult fit_linear(const std::vector<double> &x, const std::vector<double> &y) {
  RegressionResult result = {REG_LINEAR, 0, 0, 0, false, "", "linear"};
  
  SimpleLinearFit fit = simple_linear_fit(x, y);
  if (!fit.valid) return result;
  
  result.a = fit.slope;
  result.b = fit.intercept;
  result.r_squared = fit.r_squared;
  result.valid = true;
  
  std::ostringstream oss;
  oss.precision(6);
  oss << std::fixed << result.a << "*x";
  if (result.b >= 0) oss << "+";
  oss << result.b;
  result.equation = oss.str();
  
  return result;
}

// 指数関数回帰: y = a * exp(bx)
// 変換: ln(y) = ln(a) + bx → 線形回帰
RegressionResult fit_exponential(const std::vector<double> &x, const std::vector<double> &y) {
  RegressionResult result = {REG_EXPONENTIAL, 0, 0, 0, false, "", "exponential"};
  
  std::vector<double> ln_y;
  std::vector<double> x_valid;
  
  for (size_t i = 0; i < y.size(); ++i) {
    if (y[i] > 0) {  // ln(y) は y > 0 のみ有効
      ln_y.push_back(std::log(y[i]));
      x_valid.push_back(x[i]);
    }
  }
  
  if (ln_y.size() < 2) return result;
  
  SimpleLinearFit fit = simple_linear_fit(x_valid, ln_y);
  if (!fit.valid) return result;
  
  result.b = fit.slope;           // b
  result.a = std::exp(fit.intercept); // a = exp(intercept)
  
  // 元のスケールでR²を再計算
  double y_mean = 0;
  for (size_t i = 0; i < y.size(); ++i) y_mean += y[i];
  y_mean /= y.size();
  
  double ss_tot = 0, ss_res = 0;
  for (size_t i = 0; i < x.size(); ++i) {
    if (y[i] > 0) {
      double y_pred = result.a * std::exp(result.b * x[i]);
      ss_res += (y[i] - y_pred) * (y[i] - y_pred);
      ss_tot += (y[i] - y_mean) * (y[i] - y_mean);
    }
  }
  
  result.r_squared = (ss_tot > 1e-10) ? (1.0 - ss_res / ss_tot) : 0;
  result.valid = true;
  
  std::ostringstream oss;
  oss.precision(6);
  oss << std::fixed << result.a << "*exp(" << result.b << "*x)";
  result.equation = oss.str();
  
  return result;
}

// 対数関数回帰: y = a * ln(x) + b
// x を ln(x) に変換して線形回帰
RegressionResult fit_logarithmic(const std::vector<double> &x, const std::vector<double> &y) {
  RegressionResult result = {REG_LOGARITHMIC, 0, 0, 0, false, "", "logarithmic"};
  
  std::vector<double> ln_x;
  std::vector<double> y_valid;
  
  for (size_t i = 0; i < x.size(); ++i) {
    if (x[i] > 0) {  // ln(x) は x > 0 のみ有効
      ln_x.push_back(std::log(x[i]));
      y_valid.push_back(y[i]);
    }
  }
  
  if (ln_x.size() < 2) return result;
  
  SimpleLinearFit fit = simple_linear_fit(ln_x, y_valid);
  if (!fit.valid) return result;
  
  result.a = fit.slope;      // a
  result.b = fit.intercept;  // b
  result.r_squared = fit.r_squared;
  result.valid = true;
  
  std::ostringstream oss;
  oss.precision(6);
  oss << std::fixed << result.a << "*ln(x)";
  if (result.b >= 0) oss << "+";
  oss << result.b;
  result.equation = oss.str();
  
  return result;
}

// 累乗関数回帰: y = a * x^b
// 変換: ln(y) = ln(a) + b*ln(x) → 線形回帰
RegressionResult fit_power(const std::vector<double> &x, const std::vector<double> &y) {
  RegressionResult result = {REG_POWER, 0, 0, 0, false, "", "power"};
  
  std::vector<double> ln_x, ln_y;
  
  for (size_t i = 0; i < x.size(); ++i) {
    if (x[i] > 0 && y[i] > 0) {
      ln_x.push_back(std::log(x[i]));
      ln_y.push_back(std::log(y[i]));
    }
  }
  
  if (ln_x.size() < 2) return result;
  
  SimpleLinearFit fit = simple_linear_fit(ln_x, ln_y);
  if (!fit.valid) return result;
  
  result.b = fit.slope;              // b (指数)
  result.a = std::exp(fit.intercept); // a = exp(intercept)
  
  // 元のスケールでR²を再計算
  double y_mean = 0;
  size_t valid_count = 0;
  for (size_t i = 0; i < y.size(); ++i) {
    if (x[i] > 0 && y[i] > 0) {
      y_mean += y[i];
      valid_count++;
    }
  }
  if (valid_count > 0) y_mean /= valid_count;
  
  double ss_tot = 0, ss_res = 0;
  for (size_t i = 0; i < x.size(); ++i) {
    if (x[i] > 0 && y[i] > 0) {
      double y_pred = result.a * std::pow(x[i], result.b);
      ss_res += (y[i] - y_pred) * (y[i] - y_pred);
      ss_tot += (y[i] - y_mean) * (y[i] - y_mean);
    }
  }
  
  result.r_squared = (ss_tot > 1e-10) ? (1.0 - ss_res / ss_tot) : 0;
  result.valid = true;
  
  std::ostringstream oss;
  oss.precision(6);
  oss << std::fixed << result.a << "*x^" << result.b;
  result.equation = oss.str();
  
  return result;
}

// 最適な回帰モデルを自動選択
RegressionResult fit_auto(const std::vector<double> &x, const std::vector<double> &y) {
  RegressionResult best = {REG_LINEAR, 0, 0, -1, false, "", ""};
  
  // 各モデルでフィッティング
  RegressionResult linear = fit_linear(x, y);
  RegressionResult exponential = fit_exponential(x, y);
  RegressionResult logarithmic = fit_logarithmic(x, y);
  RegressionResult power = fit_power(x, y);
  
  // R²が最大のものを選択
  if (linear.valid && linear.r_squared > best.r_squared) best = linear;
  if (exponential.valid && exponential.r_squared > best.r_squared) best = exponential;
  if (logarithmic.valid && logarithmic.r_squared > best.r_squared) best = logarithmic;
  if (power.valid && power.r_squared > best.r_squared) best = power;
  
  return best;
}

// 指定されたモデルタイプで回帰を実行
RegressionResult calculate_regression(const std::vector<double> &x, const std::vector<double> &y, RegressionType type) {
  switch (type) {
    case REG_LINEAR:      return fit_linear(x, y);
    case REG_EXPONENTIAL: return fit_exponential(x, y);
    case REG_LOGARITHMIC: return fit_logarithmic(x, y);
    case REG_POWER:       return fit_power(x, y);
    case REG_AUTO:        return fit_auto(x, y);
    default:              return fit_linear(x, y);
  }
}

// 文字列からモデルタイプを取得
RegressionType get_regression_type(const std::string &type_str) {
  if (type_str == "linear") return REG_LINEAR;
  if (type_str == "exponential" || type_str == "exp") return REG_EXPONENTIAL;
  if (type_str == "logarithmic" || type_str == "log") return REG_LOGARITHMIC;
  if (type_str == "power" || type_str == "pow") return REG_POWER;
  if (type_str == "auto") return REG_AUTO;
  return REG_LINEAR;  // デフォルト
}

// モデルタイプから文字列を取得
std::string get_regression_type_name(RegressionType type) {
  switch (type) {
    case REG_LINEAR:      return "linear";
    case REG_EXPONENTIAL: return "exponential";
    case REG_LOGARITHMIC: return "logarithmic";
    case REG_POWER:       return "power";
    case REG_AUTO:        return "auto";
    default:              return "linear";
  }
}

// 最小二乗法による線形回帰を計算（後方互換性のため残す）
// y = ax + b の形式で近似
LinearRegression calculate_linear_regression(const std::vector<double> &x, const std::vector<double> &y) {
  LinearRegression result = {0, 0, 0, false};
  
  size_t n = x.size();
  if (n < 2 || n != y.size()) return result;
  
  // 各種合計を計算
  double sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;
  for (size_t i = 0; i < n; ++i) {
    sum_x += x[i];
    sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_x2 += x[i] * x[i];
    sum_y2 += y[i] * y[i];
  }
  
  // 傾きと切片を計算
  double denominator = n * sum_x2 - sum_x * sum_x;
  if (std::abs(denominator) < 1e-10) return result; // ゼロ除算防止
  
  result.slope = (n * sum_xy - sum_x * sum_y) / denominator;
  result.intercept = (sum_y * sum_x2 - sum_x * sum_xy) / denominator;
  
  // 決定係数 R² を計算
  double y_mean = sum_y / n;
  double ss_tot = 0, ss_res = 0;
  for (size_t i = 0; i < n; ++i) {
    double y_pred = result.slope * x[i] + result.intercept;
    ss_res += (y[i] - y_pred) * (y[i] - y_pred);
    ss_tot += (y[i] - y_mean) * (y[i] - y_mean);
  }
  
  result.r_squared = (ss_tot > 1e-10) ? (1.0 - ss_res / ss_tot) : 0;
  result.valid = true;
  
  return result;
}

// テーブルから指定列のデータを抽出して線形回帰を計算
LinearRegression calculate_regression_from_table(const Table &t, size_t x_col, size_t y_col) {
  std::vector<double> x_data, y_data;
  
  for (const auto &row : t) {
    if (row.size() > x_col && row.size() > y_col) {
      if (is_number(row[x_col]) && is_number(row[y_col])) {
        x_data.push_back(std::stod(row[x_col]));
        y_data.push_back(std::stod(row[y_col]));
      }
    }
  }
  
  return calculate_linear_regression(x_data, y_data);
}

Table parse(const std::string &input) {
  Table t;
  std::stringstream ss(input);
  std::string line;
  while (std::getline(ss, line)) {
    trim(line);
    if (line.empty()) continue;
    auto cells = split(line);
    for (auto &c : cells) trim(c);
    t.push_back(cells);
  }
  return t;
}

std::string escape(const std::string &s) {
  std::string out;
  for (char c : s) {
    if (c == '&' || c == '%' || c == '$' || c == '#' || c == '_' || c == '{' || c == '}') out += '\\';
    out += c;
  }
  return out;
}

std::string to_latex(const Table &t) {
  if (t.empty()) return "";
  std::string out = "\\begin{tabular}{" + std::string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      out += escape(row[i]);
    }
    out += " \\\\\n";
  }
  return out + "\\hline\n\\end{tabular}";
}

std::string to_latex_rounded(const Table &t, int decimals) {
  if (t.empty()) return "";
  std::string out = "\\begin{tabular}{" + std::string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      std::string cell = round_number(row[i], decimals);
      out += escape(cell);
    }
    out += " \\\\\n";
  }
  return out + "\\hline\n\\end{tabular}";
}

std::string to_latex_sig_figs(const Table &t, int sig_figs) {
  if (t.empty()) return "";
  std::string out = "\\begin{tabular}{" + std::string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      std::string cell = round_significant_figures(row[i], sig_figs);
      out += escape(cell);
    }
    out += " \\\\\n";
  }
  return out + "\\hline\n\\end{tabular}";
}

std::string to_csv(const Table &t) {
  std::string out;
  for (size_t i = 0; i < t.size(); ++i) {
    for (size_t j = 0; j < t[i].size(); ++j) {
      if (j) out += ',';
      out += t[i][j];
    }
    if (i + 1 < t.size()) out += '\n';
  }
  return out;
}

std::string to_tikz_graph(const Table &t, const std::string &filename, int sig_figs, const std::string &legend_pos, const std::string &scale_mode) {
  if (t.empty()) return "";
  
  size_t num_cols = t[0].size();
  if (num_cols < 2) return ""; // 少なくとも2列必要（x軸とy軸）
  if (sig_figs < 1) sig_figs = 3;
  
  // データの最小値・最大値を計算
  double x_min = 1e100, x_max = -1e100;
  double y_min = 1e100, y_max = -1e100;
  
  for (const auto &row : t) {
    if (row.size() >= 2) {
      // x軸データ（第1列）
      if (is_number(row[0])) {
        double x_val = std::stod(row[0]);
        x_min = std::min(x_min, x_val);
        x_max = std::max(x_max, x_val);
      }
      // y軸データ（第2列以降）
      for (size_t i = 1; i < row.size(); ++i) {
        if (is_number(row[i])) {
          double y_val = std::stod(row[i]);
          y_min = std::min(y_min, y_val);
          y_max = std::max(y_max, y_val);
        }
      }
    }
  }
  
  // ガウス記号を適用
  int xmin_val = (int)std::floor(x_min);
  int xmax_val = (int)std::floor(x_max) + 1;
  int ymin_val = (int)std::floor(y_min);
  int ymax_val = (int)std::floor(y_max) + 1;
  
  std::string out = "\\begin{figure}[H]\n";
  out += "    \\centering\n";
  out += "    \\begin{tikzpicture}\n";
  out += "        \\begin{axis}[\n";
  out += "            width=0.8\\textwidth,\n";
  out += "            height=0.6\\textwidth,\n";
  out += "            minor tick num=1,\n";
  out += "            tick style={major tick length=5pt, minor tick length=3pt, tick pos=both, color=black, line width=0.5pt},\n";
  out += "            tick align=inside,\n";
  out += "            xmajorgrids=false,\n";
  out += "            ymajorgrids=false,\n";
  out += "            xminorgrids=false,\n";
  out += "            yminorgrids=false,\n";
  out += "            axis line style={-},\n";
  out += "            scaled ticks=false,\n";
  out += "            xticklabel style={/pgf/number format/fixed},\n";
  out += "            yticklabel style={/pgf/number format/fixed},\n";
  out += "            xticklabel style = {/pgf/number format/precision=\"";
  out += std::to_string(sig_figs);
  out += "\"},\n";
  out += "            yticklabel style = {/pgf/number format/precision=\"";
  out += std::to_string(sig_figs);
  out += "\"},\n";
  out += "            legend cell align = {left},\n";
  out += "            legend pos = ";
  out += legend_pos;
  out += ",\n";
  
  // スケールモードを設定
  if (scale_mode == "semilog") {
    out += "            ymode=log,\n";
  } else if (scale_mode == "loglog") {
    out += "            xmode=log,\n";
    out += "            ymode=log,\n";
  }
  
  out += "            xlabel={x軸},\n";
  out += "            ylabel={y軸},\n";
  out += "            xmin=";
  out += std::to_string(xmin_val);
  out += ", xmax=";
  out += std::to_string(xmax_val);
  out += ",\n";
  out += "            ymin=";
  out += std::to_string(ymin_val);
  out += ", ymax=";
  out += std::to_string(ymax_val);
  out += ",\n";
  
  // (max-min)/5刻みで目盛りを設定
  int x_step = (xmax_val - xmin_val) / 5;
  int y_step = (ymax_val - ymin_val) / 5;
  if (x_step < 1) x_step = 1;
  if (y_step < 1) y_step = 1;
  
  out += "            xtick={";
  for (int i = xmin_val; i <= xmax_val; i += x_step) {
    if (i != xmin_val) out += ",";
    out += std::to_string(i);
  }
  out += "},\n";
  
  out += "            ytick={";
  for (int i = ymin_val; i <= ymax_val; i += y_step) {
    if (i != ymin_val) out += ",";
    out += std::to_string(i);
  }
  out += "}\n";
  out += "        ]\n";
  
  // 各y列に対してaddplotを生成（列1がx軸、列2以降がy軸）
  for (size_t i = 1; i < num_cols; ++i) {
    out += "            \\addplot [smooth, mark=*, draw] table [col sep=comma, x index=0, y index=";
    out += std::to_string(i);
    out += "] {";
    out += filename;
    out += ".csv};\n";
    out += "            \\addlegendentry{凡例";
    out += std::to_string(i);
    out += "}\n";
  }
  
  out += "        \\end{axis}\n";
  out += "    \\end{tikzpicture}\n";
  out += "    \\caption{図題}\n";
  out += "    \\label{fig:label}\n";
  out += "\\end{figure}\n";
  
  return out;
}

std::string to_tikz_graph_preview(const Table &t, int sig_figs, const std::string &legend_pos, const std::string &scale_mode) {
  if (t.empty()) return "";
  
  size_t num_cols = t[0].size();
  if (num_cols < 2) return ""; // 少なくとも2列必要（x軸とy軸）
  if (sig_figs < 1) sig_figs = 3;
  
  // データの最小値・最大値を計算
  double x_min = 1e100, x_max = -1e100;
  double y_min = 1e100, y_max = -1e100;
  
  for (const auto &row : t) {
    if (row.size() >= 2) {
      if (is_number(row[0])) {
        double x_val = std::stod(row[0]);
        x_min = std::min(x_min, x_val);
        x_max = std::max(x_max, x_val);
      }
      for (size_t i = 1; i < row.size(); ++i) {
        if (is_number(row[i])) {
          double y_val = std::stod(row[i]);
          y_min = std::min(y_min, y_val);
          y_max = std::max(y_max, y_val);
        }
      }
    }
  }
  
  int xmin_val = (int)std::floor(x_min);
  int xmax_val = (int)std::floor(x_max) + 1;
  int ymin_val = (int)std::floor(y_min);
  int ymax_val = (int)std::floor(y_max) + 1;
  
  std::string out = "\\begin{tikzpicture}\n";
  out += "  \\begin{axis}[\n";
  out += "    width=0.8\\textwidth,\n";
  out += "    height=0.6\\textwidth,\n";
  out += "    minor tick num=1,\n";
  out += "    tick style={major tick length=5pt, minor tick length=3pt, tick pos=both, color=black, line width=0.5pt},\n";
  out += "    tick align=inside,\n";
  out += "    xmajorgrids=false,\n";
  out += "    ymajorgrids=false,\n";
  out += "    xminorgrids=false,\n";
  out += "    yminorgrids=false,\n";
  out += "    axis line style={-},\n";
  out += "    scaled ticks=false,\n";
  out += "    legend cell align = {left},\n";
  out += "    legend pos = ";
  out += legend_pos;
  out += ",\n";
  
  if (scale_mode == "semilog") {
    out += "    ymode=log,\n";
  } else if (scale_mode == "loglog") {
    out += "    xmode=log,\n";
    out += "    ymode=log,\n";
  }
  
  out += "    xlabel={x軸},\n";
  out += "    ylabel={y軸},\n";
  out += "    xmin=";
  out += std::to_string(xmin_val);
  out += ", xmax=";
  out += std::to_string(xmax_val);
  out += ",\n";
  out += "    ymin=";
  out += std::to_string(ymin_val);
  out += ", ymax=";
  out += std::to_string(ymax_val);
  out += ",\n";
  
  int x_step = (xmax_val - xmin_val) / 5;
  int y_step = (ymax_val - ymin_val) / 5;
  if (x_step < 1) x_step = 1;
  if (y_step < 1) y_step = 1;
  
  out += "    xtick={";
  for (int i = xmin_val; i <= xmax_val; i += x_step) {
    if (i != xmin_val) out += ",";
    out += std::to_string(i);
  }
  out += "},\n";
  
  out += "    ytick={";
  for (int i = ymin_val; i <= ymax_val; i += y_step) {
    if (i != ymin_val) out += ",";
    out += std::to_string(i);
  }
  out += "}\n";
  out += "  ]\n";
  
  // データを埋め込み形式で生成
  for (size_t col = 1; col < num_cols; ++col) {
    out += "    \\addplot [smooth, mark=*, draw] coordinates {\n";
    for (const auto &row : t) {
      if (row.size() > col && is_number(row[0]) && is_number(row[col])) {
        out += "      (";
        out += row[0];
        out += ",";
        out += row[col];
        out += ")\n";
      }
    }
    out += "    };\n";
    out += "    \\addlegendentry{凡例";
    out += std::to_string(col);
    out += "}\n";
  }
  
  out += "  \\end{axis}\n";
  out += "\\end{tikzpicture}\n";
  
  return out;
}

char* dup(const std::string &s) {
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
EMSCRIPTEN_KEEPALIVE char* gen_latex_rounded(const char* in, int decimals) {
  return in ? dup(to_latex_rounded(parse(in), decimals)) : dup("");
}
EMSCRIPTEN_KEEPALIVE char* gen_latex_sig_figs(const char* in, int sig_figs) {
  return in ? dup(to_latex_sig_figs(parse(in), sig_figs)) : dup("");
}
EMSCRIPTEN_KEEPALIVE char* gen_tikz_graph(const char* in, const char* filename, int sig_figs, const char* legend_pos, const char* scale_mode) {
  if (!in || !filename) return dup("");
  std::string lp = legend_pos ? legend_pos : "north west";
  std::string sm = scale_mode ? scale_mode : "linear";
  return dup(to_tikz_graph(parse(in), filename, sig_figs, lp, sm));
}
EMSCRIPTEN_KEEPALIVE char* gen_tikz_graph_preview(const char* in, int sig_figs, const char* legend_pos, const char* scale_mode) {
  if (!in) return dup("");
  std::string lp = legend_pos ? legend_pos : "north west";
  std::string sm = scale_mode ? scale_mode : "linear";
  return dup(to_tikz_graph_preview(parse(in), sig_figs, lp, sm));
}

// 最小二乗法による線形回帰の結果を取得
// 戻り値: JSON形式の文字列 {"slope": a, "intercept": b, "r_squared": R², "valid": true/false}
EMSCRIPTEN_KEEPALIVE char* gen_linear_regression(const char* in, int x_col, int y_col) {
  if (!in) return dup("{\"valid\":false}");
  
  Table t = parse(in);
  LinearRegression reg = calculate_regression_from_table(t, (size_t)x_col, (size_t)y_col);
  
  std::ostringstream oss;
  oss.precision(15);
  oss << "{\"slope\":" << reg.slope 
      << ",\"intercept\":" << reg.intercept 
      << ",\"r_squared\":" << reg.r_squared 
      << ",\"valid\":" << (reg.valid ? "true" : "false") << "}";
  
  return dup(oss.str());
}

// すべてのy列に対する線形回帰を一括計算
// 戻り値: JSON配列形式
EMSCRIPTEN_KEEPALIVE char* gen_all_linear_regressions(const char* in) {
  if (!in) return dup("[]");
  
  Table t = parse(in);
  if (t.empty() || t[0].size() < 2) return dup("[]");
  
  size_t num_cols = t[0].size();
  std::ostringstream oss;
  oss.precision(15);
  oss << "[";
  
  for (size_t col = 1; col < num_cols; ++col) {
    if (col > 1) oss << ",";
    LinearRegression reg = calculate_regression_from_table(t, 0, col);
    oss << "{\"column\":" << col
        << ",\"slope\":" << reg.slope 
        << ",\"intercept\":" << reg.intercept 
        << ",\"r_squared\":" << reg.r_squared 
        << ",\"valid\":" << (reg.valid ? "true" : "false") << "}";
  }
  
  oss << "]";
  return dup(oss.str());
}

// 指定されたモデルタイプで回帰を実行
// model_type: "linear", "exponential", "logarithmic", "power", "auto"
EMSCRIPTEN_KEEPALIVE char* gen_regression(const char* in, int x_col, int y_col, const char* model_type) {
  if (!in) return dup("{\"valid\":false}");
  
  Table t = parse(in);
  std::vector<double> x_data, y_data;
  
  for (const auto &row : t) {
    if (row.size() > (size_t)x_col && row.size() > (size_t)y_col) {
      if (is_number(row[x_col]) && is_number(row[y_col])) {
        x_data.push_back(std::stod(row[x_col]));
        y_data.push_back(std::stod(row[y_col]));
      }
    }
  }
  
  std::string type_str = model_type ? model_type : "auto";
  RegressionType type = get_regression_type(type_str);
  RegressionResult reg = calculate_regression(x_data, y_data, type);
  
  std::ostringstream oss;
  oss.precision(15);
  oss << "{\"type\":\"" << reg.type_name << "\""
      << ",\"a\":" << reg.a 
      << ",\"b\":" << reg.b 
      << ",\"r_squared\":" << reg.r_squared 
      << ",\"equation\":\"" << reg.equation << "\""
      << ",\"valid\":" << (reg.valid ? "true" : "false") << "}";
  
  return dup(oss.str());
}

// すべてのy列に対して指定モデルで回帰を一括計算
EMSCRIPTEN_KEEPALIVE char* gen_all_regressions(const char* in, const char* model_type) {
  if (!in) return dup("[]");
  
  Table t = parse(in);
  if (t.empty() || t[0].size() < 2) return dup("[]");
  
  std::string type_str = model_type ? model_type : "auto";
  RegressionType type = get_regression_type(type_str);
  
  size_t num_cols = t[0].size();
  std::ostringstream oss;
  oss.precision(15);
  oss << "[";
  
  for (size_t col = 1; col < num_cols; ++col) {
    if (col > 1) oss << ",";
    
    std::vector<double> x_data, y_data;
    for (const auto &row : t) {
      if (row.size() > col && is_number(row[0]) && is_number(row[col])) {
        x_data.push_back(std::stod(row[0]));
        y_data.push_back(std::stod(row[col]));
      }
    }
    
    RegressionResult reg = calculate_regression(x_data, y_data, type);
    oss << "{\"column\":" << col
        << ",\"type\":\"" << reg.type_name << "\""
        << ",\"a\":" << reg.a 
        << ",\"b\":" << reg.b 
        << ",\"r_squared\":" << reg.r_squared 
        << ",\"equation\":\"" << reg.equation << "\""
        << ",\"valid\":" << (reg.valid ? "true" : "false") << "}";
  }
  
  oss << "]";
  return dup(oss.str());
}

// 全モデルで回帰を実行して比較結果を返す
EMSCRIPTEN_KEEPALIVE char* gen_regression_comparison(const char* in, int x_col, int y_col) {
  if (!in) return dup("[]");
  
  Table t = parse(in);
  std::vector<double> x_data, y_data;
  
  for (const auto &row : t) {
    if (row.size() > (size_t)x_col && row.size() > (size_t)y_col) {
      if (is_number(row[x_col]) && is_number(row[y_col])) {
        x_data.push_back(std::stod(row[x_col]));
        y_data.push_back(std::stod(row[y_col]));
      }
    }
  }
  
  RegressionResult linear = fit_linear(x_data, y_data);
  RegressionResult exponential = fit_exponential(x_data, y_data);
  RegressionResult logarithmic = fit_logarithmic(x_data, y_data);
  RegressionResult power = fit_power(x_data, y_data);
  
  std::ostringstream oss;
  oss.precision(15);
  oss << "[";
  
  // 線形
  oss << "{\"type\":\"linear\",\"a\":" << linear.a << ",\"b\":" << linear.b 
      << ",\"r_squared\":" << linear.r_squared << ",\"equation\":\"" << linear.equation 
      << "\",\"valid\":" << (linear.valid ? "true" : "false") << "}";
  
  // 指数
  oss << ",{\"type\":\"exponential\",\"a\":" << exponential.a << ",\"b\":" << exponential.b 
      << ",\"r_squared\":" << exponential.r_squared << ",\"equation\":\"" << exponential.equation 
      << "\",\"valid\":" << (exponential.valid ? "true" : "false") << "}";
  
  // 対数
  oss << ",{\"type\":\"logarithmic\",\"a\":" << logarithmic.a << ",\"b\":" << logarithmic.b 
      << ",\"r_squared\":" << logarithmic.r_squared << ",\"equation\":\"" << logarithmic.equation 
      << "\",\"valid\":" << (logarithmic.valid ? "true" : "false") << "}";
  
  // 累乗
  oss << ",{\"type\":\"power\",\"a\":" << power.a << ",\"b\":" << power.b 
      << ",\"r_squared\":" << power.r_squared << ",\"equation\":\"" << power.equation 
      << "\",\"valid\":" << (power.valid ? "true" : "false") << "}";
  
  oss << "]";
  return dup(oss.str());
}

// 近似曲線付きのTikZグラフを生成（プレビュー用）
// regression_type: "linear", "exponential", "logarithmic", "power", "auto"
EMSCRIPTEN_KEEPALIVE char* gen_tikz_graph_with_regression_preview(const char* in, int sig_figs, const char* legend_pos, const char* scale_mode, const char* regression_type) {
  if (!in) return dup("");
  std::string lp = legend_pos ? legend_pos : "north west";
  std::string sm = scale_mode ? scale_mode : "linear";
  std::string rt = regression_type ? regression_type : "auto";
  RegressionType reg_type = get_regression_type(rt);
  
  Table t = parse(in);
  if (t.empty()) return dup("");
  
  size_t num_cols = t[0].size();
  if (num_cols < 2) return dup("");
  if (sig_figs < 1) sig_figs = 3;
  
  // データの最小値・最大値を計算
  double x_min = 1e100, x_max = -1e100;
  double y_min = 1e100, y_max = -1e100;
  
  for (const auto &row : t) {
    if (row.size() >= 2) {
      if (is_number(row[0])) {
        double x_val = std::stod(row[0]);
        x_min = std::min(x_min, x_val);
        x_max = std::max(x_max, x_val);
      }
      for (size_t i = 1; i < row.size(); ++i) {
        if (is_number(row[i])) {
          double y_val = std::stod(row[i]);
          y_min = std::min(y_min, y_val);
          y_max = std::max(y_max, y_val);
        }
      }
    }
  }
  
  int xmin_val = (int)std::floor(x_min);
  int xmax_val = (int)std::floor(x_max) + 1;
  int ymin_val = (int)std::floor(y_min);
  int ymax_val = (int)std::floor(y_max) + 1;
  
  std::string out = "\\begin{tikzpicture}\n";
  out += "  \\begin{axis}[\n";
  out += "    width=0.8\\textwidth,\n";
  out += "    height=0.6\\textwidth,\n";
  out += "    minor tick num=1,\n";
  out += "    tick style={major tick length=5pt, minor tick length=3pt, tick pos=both, color=black, line width=0.5pt},\n";
  out += "    tick align=inside,\n";
  out += "    xmajorgrids=false,\n";
  out += "    ymajorgrids=false,\n";
  out += "    xminorgrids=false,\n";
  out += "    yminorgrids=false,\n";
  out += "    axis line style={-},\n";
  out += "    scaled ticks=false,\n";
  out += "    legend cell align = {left},\n";
  out += "    legend pos = ";
  out += lp;
  out += ",\n";
  
  if (sm == "semilog") {
    out += "    ymode=log,\n";
  } else if (sm == "loglog") {
    out += "    xmode=log,\n";
    out += "    ymode=log,\n";
  }
  
  out += "    xlabel={x軸},\n";
  out += "    ylabel={y軸},\n";
  out += "    xmin=";
  out += std::to_string(xmin_val);
  out += ", xmax=";
  out += std::to_string(xmax_val);
  out += ",\n";
  out += "    ymin=";
  out += std::to_string(ymin_val);
  out += ", ymax=";
  out += std::to_string(ymax_val);
  out += ",\n";
  
  int x_step = (xmax_val - xmin_val) / 5;
  int y_step = (ymax_val - ymin_val) / 5;
  if (x_step < 1) x_step = 1;
  if (y_step < 1) y_step = 1;
  
  out += "    xtick={";
  for (int i = xmin_val; i <= xmax_val; i += x_step) {
    if (i != xmin_val) out += ",";
    out += std::to_string(i);
  }
  out += "},\n";
  
  out += "    ytick={";
  for (int i = ymin_val; i <= ymax_val; i += y_step) {
    if (i != ymin_val) out += ",";
    out += std::to_string(i);
  }
  out += "}\n";
  out += "  ]\n";
  
  // 各y列に対してデータプロットと近似曲線を生成
  for (size_t col = 1; col < num_cols; ++col) {
    // データを抽出
    std::vector<double> x_data, y_data;
    for (const auto &row : t) {
      if (row.size() > col && is_number(row[0]) && is_number(row[col])) {
        x_data.push_back(std::stod(row[0]));
        y_data.push_back(std::stod(row[col]));
      }
    }
    
    // データプロット
    out += "    \\addplot [only marks, mark=*, draw] coordinates {\n";
    for (size_t i = 0; i < x_data.size(); ++i) {
      out += "      (";
      out += std::to_string(x_data[i]);
      out += ",";
      out += std::to_string(y_data[i]);
      out += ")\n";
    }
    out += "    };\n";
    out += "    \\addlegendentry{データ";
    out += std::to_string(col);
    out += "}\n";
    
    // 近似曲線を計算して追加
    RegressionResult reg = calculate_regression(x_data, y_data, reg_type);
    if (reg.valid) {
      std::ostringstream eq;
      eq.precision(sig_figs);
      eq << std::fixed;
      
      // モデルに応じた数式を生成
      std::string func_expr;
      switch (reg.type) {
        case REG_LINEAR:
          func_expr = std::to_string(reg.a) + "*x + " + std::to_string(reg.b);
          break;
        case REG_EXPONENTIAL:
          func_expr = std::to_string(reg.a) + "*exp(" + std::to_string(reg.b) + "*x)";
          break;
        case REG_LOGARITHMIC:
          func_expr = std::to_string(reg.a) + "*ln(x) + " + std::to_string(reg.b);
          break;
        case REG_POWER:
          func_expr = std::to_string(reg.a) + "*x^" + std::to_string(reg.b);
          break;
        default:
          func_expr = std::to_string(reg.a) + "*x + " + std::to_string(reg.b);
      }
      
      out += "    \\addplot [no markers, domain=";
      out += std::to_string(std::max(0.01, (double)xmin_val)); // 対数関数用に0を避ける
      out += ":";
      out += std::to_string(xmax_val);
      out += ", samples=100, dashed] {";
      out += func_expr;
      out += "};\n";
      
      // 凡例にモデル名、係数、R²を表示
      eq.str("");
      eq << reg.type_name << " ($" << reg.equation << "$, $R^2=" << reg.r_squared << "$)";
      out += "    \\addlegendentry{";
      out += eq.str();
      out += "}\n";
    }
  }
  
  out += "  \\end{axis}\n";
  out += "\\end{tikzpicture}\n";
  
  return dup(out);
}

// 近似曲線付きのTikZグラフを生成（ファイル参照版）
// regression_type: "linear", "exponential", "logarithmic", "power", "auto"
EMSCRIPTEN_KEEPALIVE char* gen_tikz_graph_with_regression(const char* in, const char* filename, int sig_figs, const char* legend_pos, const char* scale_mode, const char* regression_type) {
  if (!in || !filename) return dup("");
  std::string lp = legend_pos ? legend_pos : "north west";
  std::string sm = scale_mode ? scale_mode : "linear";
  std::string rt = regression_type ? regression_type : "auto";
  RegressionType reg_type = get_regression_type(rt);
  
  Table t = parse(in);
  if (t.empty()) return dup("");
  
  size_t num_cols = t[0].size();
  if (num_cols < 2) return dup("");
  if (sig_figs < 1) sig_figs = 3;
  
  // データの最小値・最大値を計算
  double x_min = 1e100, x_max = -1e100;
  double y_min = 1e100, y_max = -1e100;
  
  for (const auto &row : t) {
    if (row.size() >= 2) {
      if (is_number(row[0])) {
        double x_val = std::stod(row[0]);
        x_min = std::min(x_min, x_val);
        x_max = std::max(x_max, x_val);
      }
      for (size_t i = 1; i < row.size(); ++i) {
        if (is_number(row[i])) {
          double y_val = std::stod(row[i]);
          y_min = std::min(y_min, y_val);
          y_max = std::max(y_max, y_val);
        }
      }
    }
  }
  
  int xmin_val = (int)std::floor(x_min);
  int xmax_val = (int)std::floor(x_max) + 1;
  int ymin_val = (int)std::floor(y_min);
  int ymax_val = (int)std::floor(y_max) + 1;
  
  std::string out = "\\begin{figure}[H]\n";
  out += "    \\centering\n";
  out += "    \\begin{tikzpicture}\n";
  out += "        \\begin{axis}[\n";
  out += "            width=0.8\\textwidth,\n";
  out += "            height=0.6\\textwidth,\n";
  out += "            minor tick num=1,\n";
  out += "            tick style={major tick length=5pt, minor tick length=3pt, tick pos=both, color=black, line width=0.5pt},\n";
  out += "            tick align=inside,\n";
  out += "            xmajorgrids=false,\n";
  out += "            ymajorgrids=false,\n";
  out += "            xminorgrids=false,\n";
  out += "            yminorgrids=false,\n";
  out += "            axis line style={-},\n";
  out += "            scaled ticks=false,\n";
  out += "            xticklabel style={/pgf/number format/fixed},\n";
  out += "            yticklabel style={/pgf/number format/fixed},\n";
  out += "            xticklabel style = {/pgf/number format/precision=\"";
  out += std::to_string(sig_figs);
  out += "\"},\n";
  out += "            yticklabel style = {/pgf/number format/precision=\"";
  out += std::to_string(sig_figs);
  out += "\"},\n";
  out += "            legend cell align = {left},\n";
  out += "            legend pos = ";
  out += lp;
  out += ",\n";
  
  if (sm == "semilog") {
    out += "            ymode=log,\n";
  } else if (sm == "loglog") {
    out += "            xmode=log,\n";
    out += "            ymode=log,\n";
  }
  
  out += "            xlabel={x軸},\n";
  out += "            ylabel={y軸},\n";
  out += "            xmin=";
  out += std::to_string(xmin_val);
  out += ", xmax=";
  out += std::to_string(xmax_val);
  out += ",\n";
  out += "            ymin=";
  out += std::to_string(ymin_val);
  out += ", ymax=";
  out += std::to_string(ymax_val);
  out += ",\n";
  
  int x_step = (xmax_val - xmin_val) / 5;
  int y_step = (ymax_val - ymin_val) / 5;
  if (x_step < 1) x_step = 1;
  if (y_step < 1) y_step = 1;
  
  out += "            xtick={";
  for (int i = xmin_val; i <= xmax_val; i += x_step) {
    if (i != xmin_val) out += ",";
    out += std::to_string(i);
  }
  out += "},\n";
  
  out += "            ytick={";
  for (int i = ymin_val; i <= ymax_val; i += y_step) {
    if (i != ymin_val) out += ",";
    out += std::to_string(i);
  }
  out += "}\n";
  out += "        ]\n";
  
  // 各y列に対してデータプロットと近似曲線を生成
  for (size_t col = 1; col < num_cols; ++col) {
    // データを抽出
    std::vector<double> x_data, y_data;
    for (const auto &row : t) {
      if (row.size() > col && is_number(row[0]) && is_number(row[col])) {
        x_data.push_back(std::stod(row[0]));
        y_data.push_back(std::stod(row[col]));
      }
    }
    
    // データプロット（CSVファイル参照）
    out += "            \\addplot [only marks, mark=*, draw] table [col sep=comma, x index=0, y index=";
    out += std::to_string(col);
    out += "] {";
    out += filename;
    out += ".csv};\n";
    out += "            \\addlegendentry{データ";
    out += std::to_string(col);
    out += "}\n";
    
    // 近似曲線を計算して追加
    RegressionResult reg = calculate_regression(x_data, y_data, reg_type);
    if (reg.valid) {
      std::ostringstream eq;
      eq.precision(sig_figs);
      eq << std::fixed;
      
      // モデルに応じた数式を生成
      std::string func_expr;
      switch (reg.type) {
        case REG_LINEAR:
          func_expr = std::to_string(reg.a) + "*x + " + std::to_string(reg.b);
          break;
        case REG_EXPONENTIAL:
          func_expr = std::to_string(reg.a) + "*exp(" + std::to_string(reg.b) + "*x)";
          break;
        case REG_LOGARITHMIC:
          func_expr = std::to_string(reg.a) + "*ln(x) + " + std::to_string(reg.b);
          break;
        case REG_POWER:
          func_expr = std::to_string(reg.a) + "*x^" + std::to_string(reg.b);
          break;
        default:
          func_expr = std::to_string(reg.a) + "*x + " + std::to_string(reg.b);
      }
      
      out += "            \\addplot [no markers, domain=";
      out += std::to_string(std::max(0.01, (double)xmin_val));
      out += ":";
      out += std::to_string(xmax_val);
      out += ", samples=100, dashed] {";
      out += func_expr;
      out += "};\n";
      
      eq.str("");
      eq << reg.type_name << " ($" << reg.equation << "$, $R^2=" << reg.r_squared << "$)";
      out += "            \\addlegendentry{";
      out += eq.str();
      out += "}\n";
    }
  }
  
  out += "        \\end{axis}\n";
  out += "    \\end{tikzpicture}\n";
  out += "    \\caption{図題}\n";
  out += "    \\label{fig:label}\n";
  out += "\\end{figure}\n";
  
  return dup(out);
}
}
