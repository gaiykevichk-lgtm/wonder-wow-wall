import { Card, Typography, Empty, Button, Space, Popconfirm, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '../model/accountStore';
import { BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';

const { Title, Text } = Typography;
const GREEN = '#4CAF50';
const CELL_PX = 20; // smaller preview
const GAP_PX = 1;

function ProjectPreview({ project }: { project: ReturnType<typeof useAccountStore.getState>['projects'][0] }) {
  const deleteProject = useAccountStore((s) => s.deleteProject);
  const navigate = useNavigate();
  const gridW = project.wallCols * (CELL_PX + GAP_PX) - GAP_PX;
  const gridH = project.wallRows * (CELL_PX + GAP_PX) - GAP_PX;

  return (
    <Card
      style={{ borderRadius: 12 }}
      hoverable
    >
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Mini grid preview */}
        <div
          style={{
            position: 'relative',
            width: gridW,
            height: gridH,
            background: project.wallColor,
            borderRadius: 8,
            border: '1px solid #E8E8E8',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {project.panels.map((panel) => (
            <div
              key={panel.id}
              style={{
                position: 'absolute',
                left: panel.col * (CELL_PX + GAP_PX),
                top: panel.row * (CELL_PX + GAP_PX),
                width: panel.widthCells * (CELL_PX + GAP_PX) - GAP_PX,
                height: panel.heightCells * (CELL_PX + GAP_PX) - GAP_PX,
                background: panel.color,
                borderRadius: 2,
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
          ))}
        </div>

        {/* Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <Title level={5} style={{ margin: '0 0 4px' }}>{project.name}</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Стена: {project.wallCols * 30}×{project.wallRows * 30} см · {project.panels.length} панелей
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              Обновлён: {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Tag color="green" style={{ fontSize: 14, padding: '2px 12px' }}>
              {project.totalPrice.toLocaleString('ru-RU')} ₽
            </Tag>
            <Space>
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                onClick={() => navigate(`/account/constructor?project=${project.id}`)}
                style={{ background: GREEN, borderColor: GREEN }}
              >
                Открыть
              </Button>
              <Popconfirm
                title="Удалить проект?"
                onConfirm={() => deleteProject(project.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            </Space>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ProjectsSection() {
  const projects = useAccountStore((s) => s.projects);
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Мои проекты</Title>
        <Button
          type="primary"
          icon={<AppstoreOutlined />}
          onClick={() => navigate('/account/constructor')}
          style={{ background: GREEN, borderColor: GREEN, borderRadius: 8 }}
        >
          Новый проект
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <Empty
            description={
              <div>
                <Text type="secondary" style={{ fontSize: 15 }}>У вас пока нет сохранённых проектов</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Перейдите в конструктор, чтобы создать свой первый проект
                </Text>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<AppstoreOutlined />}
              onClick={() => navigate('/account/constructor')}
              style={{ background: GREEN, borderColor: GREEN, borderRadius: 8, marginTop: 8 }}
            >
              Создать проект
            </Button>
          </Empty>
        </Card>
      ) : (
        projects.map((project) => <ProjectPreview key={project.id} project={project} />)
      )}
    </div>
  );
}
