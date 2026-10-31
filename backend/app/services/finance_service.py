import math


def calculate_emi(principal, annual_rate, months):
    if principal <= 0 or principal > 100000000000:
        raise ValueError("Loan amount must be positive and within the allowed limit.")

    if annual_rate < 0 or annual_rate > 100:
        raise ValueError("Annual interest rate must be between 0 and 100.")

    if isinstance(months, bool) or not isinstance(months, int) or not 1 <= months <= 600:
        raise ValueError("Loan duration must be between 1 and 600 months.")

    monthly_rate = annual_rate / 1200

    if monthly_rate == 0:
        emi = principal / months
    else:
        factor = (1 + monthly_rate) ** months
        emi = principal * monthly_rate * factor / (factor - 1)

    total_payment = emi * months

    return {
        "monthly_emi": round(emi, 2),
        "principal": round(principal, 2),
        "total_interest": round(total_payment - principal, 2),
        "total_payment": round(total_payment, 2),
        "duration_months": months
    }


def calculate_budget(income, expenses):
    if isinstance(income, bool) or not isinstance(income, (int, float)):
        raise ValueError("Income must be numeric.")

    if not math.isfinite(income) or income < 0 or income > 100000000000:
        raise ValueError("Invalid monthly income.")

    if not isinstance(expenses, dict) or len(expenses) > 50:
        raise ValueError("Expenses must be a valid category dictionary.")

    validated = {}

    for category, amount in expenses.items():
        if not isinstance(category, str) or not category.strip() or len(category) > 60:
            raise ValueError("Invalid expense category.")

        if isinstance(amount, bool) or not isinstance(amount, (int, float)):
            raise ValueError(f"Invalid amount for {category}.")

        if not math.isfinite(amount) or amount < 0 or amount > 100000000000:
            raise ValueError(f"Invalid amount for {category}.")

        validated[category.strip()] = round(amount, 2)

    total_expenses = sum(validated.values())
    balance = income - total_expenses

    breakdown = {
        category: {
            "amount": amount,
            "percentage": round(amount / income * 100, 2) if income else 0
        }
        for category, amount in validated.items()
    }

    return {
        "monthly_income": round(income, 2),
        "total_expenses": round(total_expenses, 2),
        "remaining_balance": round(balance, 2),
        "savings_rate": round(balance / income * 100, 2) if income else 0,
        "budget_status": "surplus" if balance > 0 else "deficit" if balance < 0 else "balanced",
        "expense_breakdown": breakdown
    }


def calculate_savings_goal(target_amount, current_savings, months):
    for name, value in (
        ("Target amount", target_amount),
        ("Current savings", current_savings)
    ):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be numeric.")

        if not math.isfinite(value) or value < 0 or value > 100000000000:
            raise ValueError(f"Invalid {name.lower()}.")

    if target_amount <= 0 or current_savings > target_amount:
        raise ValueError("Target must be positive and current savings cannot exceed target.")

    if isinstance(months, bool) or not isinstance(months, int) or not 1 <= months <= 600:
        raise ValueError("Duration must be between 1 and 600 months.")

    remaining = target_amount - current_savings

    return {
        "target_amount": round(target_amount, 2),
        "current_savings": round(current_savings, 2),
        "remaining_amount": round(remaining, 2),
        "monthly_saving_required": round(remaining / months, 2),
        "duration_months": months
    }
