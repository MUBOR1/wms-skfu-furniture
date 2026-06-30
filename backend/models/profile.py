# models/profile.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    phone = Column(String(20), unique=True, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    birth_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", backref="profile")

class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", backref="favorites")
    product = relationship("Product", backref="favorited_by")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    rating = Column(Integer, nullable=False)  # 1-5
    text = Column(Text, nullable=True)
    photos = Column(String(1000), nullable=True)  # JSON array of URLs
    is_verified_purchase = Column(Boolean, default=False)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", backref="reviews")
    product = relationship("Product", backref="reviews")
    order = relationship("Order", backref="reviews")

class CartItem(Base):
    __tablename__ = "cart_items"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", backref="cart_items")
    product = relationship("Product", backref="cart_items")