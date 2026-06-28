# Five In Row

一个基于命令行的 15x15 五子棋项目，当前支持人人对战、人机强引擎对战、黑棋禁手、胜负判断和悔棋。

## 目录结构

```text
.
├── inc/              # 公共头文件
├── src/              # C 源码
├── tests/            # 自动化测试
├── index.html        # 网页版五子棋入口
├── styles.css        # 网页样式
├── script.js         # 网页交互和搜索引擎
├── presearch-books/  # 网页 AI 开局预搜索书
├── bin/              # 可执行文件输出目录，构建生成
├── build*/           # CMake 构建目录，构建生成
├── CMakeLists.txt    # CMake 构建入口
└── docs/             # 架构说明
```

## 构建

需要先安装 CMake 和可用的 C 编译器，例如 MinGW-w64、MSVC 或 Clang。

```powershell
cmake -S . -B build
cmake --build build
```

构建产物默认输出到 `bin/five_in_row.exe`。

## 运行

```powershell
.\bin\five_in_row.exe
```

输入示例：

- `H8`：在 H 列第 8 行落子
- `00`：退出当前对局
- `11`：悔棋一步

人机强引擎模式默认使用：

- 迭代加深搜索
- Principal Variation Search / alpha-beta 剪枝
- Zobrist 哈希置换表
- 候选点裁剪和棋形排序
- 攻防棋形评分
- 黑棋禁手过滤

## 网页版

本分支在仓库根目录提供静态网页版 `gomoku`，打开 `index.html` 即可运行。网页包含人人、人机、机机对战，黑棋禁手校验，悔棋，候选点评分，PVS/VCF 搜索和本地预搜索书，不依赖在线资源。工具栏中的“启用NN”开关勾选后，会把机器思考和提示切换到 NN hybrid 引擎：先筛直接胜和必须围堵，再调用浏览器端 policy/value 推理排序。

生成课程提交 zip：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_submission.ps1
```

脚本会把网页必需文件暂存到 `dist/submission-root/`，压缩为 `dist/gomoku.zip`，并运行 CS101 提交结构校验。

## 开发约定

- 源码统一使用 UTF-8。
- C 标准使用 C11。
- 构建产物放在 `build/` 和 `bin/`，不纳入版本管理。
- 头文件只暴露模块边界，模块内部辅助函数使用 `static`。

更多模块关系见 [docs/architecture.md](docs/architecture.md)。

## NN 融合引擎分支

`nn-engine` 分支提供实验性的纯 C 神经网络融合引擎：

- Python checkpoint 导出为本地 `.gnn` INT8 权重包。
- C 端加载 `.gnn`，执行纯 C policy/value 推理。
- `nn-fusion` profile 先做立即胜/防守短路，再用 NN policy 和静态棋形补偿选点。

本地 smoke：

```bash
python3 tools/export_gomoku_alpha_weights.py \
  --checkpoint /data/home/shijieheng/gomoku-alphazero/checkpoints/autonomous_refined.pt \
  --output models/autonomous_refined_i8.gnn \
  --metadata models/autonomous_refined_i8.json
cmake -S . -B build-debug -DCMAKE_BUILD_TYPE=Debug
cmake --build build-debug
ctest --test-dir build-debug --output-on-failure
cmake -S . -B build-release -DCMAKE_BUILD_TYPE=Release
cmake --build build-release --target nn_engine_probe pbrain_five_in_row
bin/nn_engine_probe models/autonomous_refined_i8.gnn --bench 20
FIVE_IN_ROW_ENGINE_PROFILE=nn-fusion \
FIVE_IN_ROW_NN_WEIGHTS=models/autonomous_refined_i8.gnn \
FIVE_IN_ROW_NN_TIME_MS=2000 \
FIVE_IN_ROW_NN_HARD_TIME_MS=3000 \
bin/pbrain-5inrow
```

详细工作流见 [docs/nn-engine-workflow.md](docs/nn-engine-workflow.md)。

## 测试

```powershell
cmake --build build-msvc
ctest --test-dir build-msvc -C Debug --output-on-failure
```
