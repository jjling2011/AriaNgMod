# AriaNgMod

[![License](https://img.shields.io/github/license/jjling2011/AriaNgMod.svg?style=flat)](https://github.com/jjling2011/AriaNgMod/blob/master/LICENSE)

AriaNgMod 是 [mayswind/AriaNg](https://github.com/mayswind/AriaNg) 的修改版。

修改内容：
 * 批量导入 BT 种子
 * 简化按扩展名选择文件
 * 添加 "@" 特殊搜索前缀。例如："@10" 表示搜索不小于 10 个文件的任务。 如果末尾添加 "c" 表示包含已结束任务。
 * 支持按比例选择大文件
 * 切换页面时清空搜索关键词

#### 在线使用（和代码同步更新）

[https://jjling2011.github.io/AriaNgMod/](https://jjling2011.github.io/AriaNgMod/)

![demo.png](./readme/demo.png)  

#### 下载发布文件（不定期更新）

[https://github.com/jjling2011/AriaNgMod/releases](https://github.com/jjling2011/AriaNgMod/releases)

#### 开发

```bash
# 安装依赖
pnpm install

# 编译
pnpm run build

# 本地测试
pnpm run serve

# 生成 all-in-one 发布文件
pnpm run allinone
```

#### 更新记录
[logs.md](./readme/logs.md)
