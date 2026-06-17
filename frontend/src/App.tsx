import { App as AntdApp, ConfigProvider } from 'antd'
import { AppRouter } from './shared/router'

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          // inherit from design system
        },
      }}
    >
      <AntdApp>
        <AppRouter />
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
