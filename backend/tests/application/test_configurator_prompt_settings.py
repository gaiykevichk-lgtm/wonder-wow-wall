import pytest
from pydantic import ValidationError
from app.application.configurator.prompt_settings import compose_generation_prompt
from app.infrastructure.api.admin.configurator_settings import PromptSettingsUpdate


def test_custom_instruction_is_used_with_context():
    value = compose_generation_prompt("  NEW INSTRUCTION  ", "Материал: дуб. Покрытие: вся стена.")
    assert value.startswith("NEW INSTRUCTION\n")
    assert "Материал: дуб" in value


@pytest.mark.parametrize("value", ["", "   ", "x" * 20001])
def test_reject_invalid_prompt(value):
    with pytest.raises(ValidationError):
        PromptSettingsUpdate(system_prompt=value)


def test_prompt_quotes_are_data():
    assert PromptSettingsUpdate(system_prompt="  ' ; DROP TABLE foo; --  ").system_prompt == "' ; DROP TABLE foo; --"


def test_pro_mode_fields_are_accepted():
    from app.infrastructure.api.configurator import DialogAnswers
    body = DialogAnswers(pro_mode=True, panel_id="p", texture_id="t", variant_id="v")
    assert body.model_dump()["variant_id"] == "v"
