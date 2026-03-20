import pytest
from app.domain.user.entities import User, UserAddress
from app.domain.user.value_objects import Email


class TestEmail:
    def test_valid_email(self):
        e = Email("test@example.com")
        assert str(e) == "test@example.com"

    def test_invalid_email(self):
        with pytest.raises(ValueError):
            Email("not-an-email")

    def test_invalid_no_domain(self):
        with pytest.raises(ValueError):
            Email("test@")


class TestUser:
    def test_create(self):
        user = User(name="Иван", email="ivan@test.ru", phone="+7 999 000 00 00")
        assert user.name == "Иван"
        assert user.email == "ivan@test.ru"
        assert user.addresses == []

    def test_update_profile(self):
        user = User(name="Old", phone="000")
        user.update_profile(name="New", phone="111")
        assert user.name == "New"
        assert user.phone == "111"

    def test_update_profile_partial(self):
        user = User(name="Old", phone="000")
        user.update_profile(name="New")
        assert user.name == "New"
        assert user.phone == "000"

    def test_add_address(self):
        user = User(name="Test")
        addr = UserAddress(label="Дом", city="Москва", street="Тверская", building="1", is_default=True)
        user.add_address(addr)
        assert len(user.addresses) == 1
        assert user.addresses[0].is_default is True

    def test_add_address_resets_default(self):
        user = User(name="Test")
        a1 = UserAddress(label="A", city="M", street="S", building="1", is_default=True)
        a2 = UserAddress(label="B", city="M", street="S", building="2", is_default=True)
        user.add_address(a1)
        user.add_address(a2)
        assert user.addresses[0].is_default is False
        assert user.addresses[1].is_default is True

    def test_remove_address(self):
        user = User(name="Test")
        a1 = UserAddress(id="addr-1", label="A")
        a2 = UserAddress(id="addr-2", label="B")
        user.addresses = [a1, a2]
        user.remove_address("addr-1")
        assert len(user.addresses) == 1
        assert user.addresses[0].id == "addr-2"

    def test_set_default_address(self):
        user = User(name="Test")
        a1 = UserAddress(id="addr-1", is_default=True)
        a2 = UserAddress(id="addr-2", is_default=False)
        user.addresses = [a1, a2]
        user.set_default_address("addr-2")
        assert user.addresses[0].is_default is False
        assert user.addresses[1].is_default is True
