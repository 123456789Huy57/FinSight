import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Các trang hiện tải dữ liệu bằng useEffect + setState (đồng bộ trạng thái tải/xoá kết quả).
      // Rule mới của React Compiler coi đây là lỗi; sẽ tính chuyện chuyển sang data-fetching riêng sau.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
])

export default eslintConfig
