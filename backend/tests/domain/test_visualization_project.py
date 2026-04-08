import pytest
from app.domain.visualizer.entities import VisualizationProject, PlacedPanelData


class TestPlacedPanelData:
    def test_create(self):
        p = PlacedPanelData(design_id="d1", size_key="30x30", color="#FF0000", x=10, y=20)
        assert p.design_id == "d1"
        assert p.x == 10
        assert p.y == 20

    def test_defaults(self):
        p = PlacedPanelData()
        assert p.size_key == "30x30"
        assert p.color == "#CCCCCC"
        assert p.render_width == 150.0
        assert p.render_height == 150.0


class TestVisualizationProject:
    def test_create(self):
        project = VisualizationProject(name="Test", user_id="u1")
        assert project.name == "Test"
        assert project.user_id == "u1"
        assert len(project.id) == 36  # UUID
        assert project.panels == []

    def test_name_empty(self):
        with pytest.raises(ValueError, match="must not be empty"):
            VisualizationProject(name="")

    def test_name_whitespace_only(self):
        with pytest.raises(ValueError, match="must not be empty"):
            VisualizationProject(name="   ")

    def test_name_too_long(self):
        with pytest.raises(ValueError, match="100 characters"):
            VisualizationProject(name="A" * 101)

    def test_name_at_limit(self):
        project = VisualizationProject(name="A" * 100)
        assert len(project.name) == 100

    def test_too_many_panels(self):
        panels = [PlacedPanelData() for _ in range(501)]
        with pytest.raises(ValueError, match="500 panels"):
            VisualizationProject(name="Test", panels=panels)

    def test_500_panels_ok(self):
        panels = [PlacedPanelData() for _ in range(500)]
        project = VisualizationProject(name="Test", panels=panels)
        assert len(project.panels) == 500

    def test_with_perspective_corners(self):
        corners = [{"x": 0, "y": 0}, {"x": 100, "y": 0}, {"x": 100, "y": 100}, {"x": 0, "y": 100}]
        project = VisualizationProject(name="Test", perspective_corners=corners)
        assert project.perspective_corners is not None
        assert len(project.perspective_corners) == 4

    def test_defaults(self):
        project = VisualizationProject(name="Test")
        assert project.photo_url == ""
        assert project.calibration_pixels_per_cm == 5.0
        assert project.perspective_corners is None
        assert project.placement_mode == "manual"
        assert project.wall_mask_base64 == ""


